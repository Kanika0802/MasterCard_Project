// blueteam/src/features/GraphFeatureExtractor.js
"use strict";

class GraphFeatureExtractor {
    constructor() {
        // Directed graph: adjacencyMap[fromNode] = Map(toNode -> [transactions])
        this.adj = new Map();
        // Inverted adjacency: inAdj[toNode] = Map(fromNode -> [transactions])
        this.inAdj = new Map();
        // Node metadata: node -> { inDegree, outDegree, totalInflow, totalOutflow, firstSeen, lastSeen }
        this.nodes = new Map();
    }

    recordTransfer({ fromAccountId, toAccountId, amount, transactionId, timestamp }) {
        if (!fromAccountId || !toAccountId) return;
        const amt = Number(amount || 0);
        const time = timestamp || new Date().toISOString();

        // 1. Update from node
        this._ensureNode(fromAccountId, time);
        const fromNode = this.nodes.get(fromAccountId);
        fromNode.totalOutflow += amt;
        fromNode.lastSeen = time;

        // 2. Update to node
        this._ensureNode(toAccountId, time);
        const toNode = this.nodes.get(toAccountId);
        toNode.totalInflow += amt;
        toNode.lastSeen = time;

        // 3. Update forward edges
        if (!this.adj.has(fromAccountId)) this.adj.set(fromAccountId, new Map());
        const fromEdges = this.adj.get(fromAccountId);
        if (!fromEdges.has(toAccountId)) fromEdges.set(toAccountId, []);
        fromEdges.get(toAccountId).push({ transactionId, amount: amt, timestamp: time });
        fromNode.outDegree = fromEdges.size;

        // 4. Update backward edges
        if (!this.inAdj.has(toAccountId)) this.inAdj.set(toAccountId, new Map());
        const toEdges = this.inAdj.get(toAccountId);
        if (!toEdges.has(fromAccountId)) toEdges.set(fromAccountId, []);
        toEdges.get(fromAccountId).push({ transactionId, amount: amt, timestamp: time });
        toNode.inDegree = toEdges.size;
    }

    _ensureNode(nodeId, time) {
        if (!this.nodes.has(nodeId)) {
            this.nodes.set(nodeId, {
                nodeId,
                inDegree: 0,
                outDegree: 0,
                totalInflow: 0,
                totalOutflow: 0,
                firstSeen: time,
                lastSeen: time,
                isKnownMule: false
            });
        }
    }

    markKnownMule(nodeId) {
        this._ensureNode(nodeId, new Date().toISOString());
        this.nodes.get(nodeId).isKnownMule = true;
    }

    extractFeatures(accountId, counterpartyId = null) {
        const node = this.nodes.get(accountId) || {
            inDegree: 0,
            outDegree: 0,
            totalInflow: 0,
            totalOutflow: 0,
            isKnownMule: false
        };

        const inDegree = node.inDegree;
        const outDegree = node.outDegree;
        const totalIn = node.totalInflow;
        const totalOut = node.totalOutflow;

        // Mule Pass-Through ratio: high flow through with low retention
        const passThroughRatio = (totalIn > 0 && totalOut > 0)
            ? Math.min(totalOut, totalIn) / Math.max(totalOut, totalIn)
            : 0;

        // Fan-in / Fan-out imbalance
        const fanInFanOutRatio = (inDegree > 0 && outDegree > 0)
            ? (inDegree / outDegree)
            : (inDegree > 0 ? inDegree : 0);

        // Cycle detection: is there a return transfer path back to accountId?
        const cycleDetected = counterpartyId ? this.hasCycle(accountId, counterpartyId, 3) : false;

        // Distance to known mule node
        const minDistanceToMule = this.findShortestPathToMule(accountId, 3);

        return {
            in_degree: inDegree,
            out_degree: outDegree,
            total_inflow: totalIn,
            total_outflow: totalOut,
            pass_through_ratio: Number(passThroughRatio.toFixed(4)),
            fan_in_fan_out_ratio: Number(fanInFanOutRatio.toFixed(4)),
            cycle_detected: cycleDetected,
            min_distance_to_mule: minDistanceToMule,
            is_known_mule: node.isKnownMule
        };
    }

    hasCycle(startNode, targetNode, maxDepth = 3) {
        if (!startNode || !targetNode || startNode === targetNode) return true;

        // Check if there is a path from targetNode back to startNode
        const visited = new Set();
        const queue = [{ node: targetNode, depth: 0 }];

        while (queue.length > 0) {
            const { node, depth } = queue.shift();
            if (node === startNode) return true;
            if (depth >= maxDepth) continue;

            visited.add(node);
            const neighbors = this.adj.get(node);
            if (neighbors) {
                for (const nextNode of neighbors.keys()) {
                    if (!visited.has(nextNode)) {
                        queue.push({ node: nextNode, depth: depth + 1 });
                    }
                }
            }
        }
        return false;
    }

    findShortestPathToMule(startNode, maxDepth = 3) {
        if (!startNode || !this.nodes.has(startNode)) return -1;
        if (this.nodes.get(startNode).isKnownMule) return 0;

        const visited = new Set();
        const queue = [{ node: startNode, distance: 0 }];

        while (queue.length > 0) {
            const { node, distance } = queue.shift();
            if (distance > maxDepth) break;

            visited.add(node);
            const nodeMeta = this.nodes.get(node);
            if (nodeMeta?.isKnownMule) return distance;

            // Check outgoing and incoming connections
            const outNeighbors = this.adj.get(node);
            if (outNeighbors) {
                for (const nxt of outNeighbors.keys()) {
                    if (!visited.has(nxt)) queue.push({ node: nxt, distance: distance + 1 });
                }
            }
            const inNeighbors = this.inAdj.get(node);
            if (inNeighbors) {
                for (const prv of inNeighbors.keys()) {
                    if (!visited.has(prv)) queue.push({ node: prv, distance: distance + 1 });
                }
            }
        }
        return -1; // No mule in neighborhood
    }

    clear() {
        this.adj.clear();
        this.inAdj.clear();
        this.nodes.clear();
    }
}

module.exports = GraphFeatureExtractor;
