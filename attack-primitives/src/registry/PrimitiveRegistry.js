// attack-primitives/src/registry/PrimitiveRegistry.js
"use strict";

const AttackPrimitive = require("../domain/AttackPrimitive");
const { PrimitiveValidationError } = require("../domain/errors");
const ALL_CANONICAL_PRIMITIVES = require("../definitions/catalog");

class PrimitiveRegistry {
    constructor(definitions = ALL_CANONICAL_PRIMITIVES) {
        this._primitives = new Map();
        this._categoryIndex = new Map();
        this._familyIndex = new Map();
        this._actionIndex = new Map();

        this._loadAndIndex(definitions);
    }

    _loadAndIndex(definitions) {
        if (!Array.isArray(definitions)) {
            throw new PrimitiveValidationError("PrimitiveRegistry: definitions must be an array.");
        }
        for (const def of definitions) {
            const primitive = def instanceof AttackPrimitive ? def : new AttackPrimitive(def);
            this.register(primitive);
        }
    }

    register(primitive) {
        if (!(primitive instanceof AttackPrimitive)) {
            throw new PrimitiveValidationError("PrimitiveRegistry: can only register AttackPrimitive instances.");
        }
        if (this._primitives.has(primitive.primitive_id)) {
            throw new PrimitiveValidationError(
                `PrimitiveRegistry: duplicate primitive_id '${primitive.primitive_id}'.`
            );
        }

        this._primitives.set(primitive.primitive_id, primitive);

        // Index by category
        if (!this._categoryIndex.has(primitive.category)) {
            this._categoryIndex.set(primitive.category, []);
        }
        this._categoryIndex.get(primitive.category).push(primitive);

        // Index by attack family
        if (!this._familyIndex.has(primitive.attack_family)) {
            this._familyIndex.set(primitive.attack_family, []);
        }
        this._familyIndex.get(primitive.attack_family).push(primitive);

        // Index by simulator action
        if (primitive.simulator_action) {
            if (!this._actionIndex.has(primitive.simulator_action)) {
                this._actionIndex.set(primitive.simulator_action, []);
            }
            this._actionIndex.get(primitive.simulator_action).push(primitive);
        }
    }

    get(primitiveId) {
        return this._primitives.get(primitiveId) || null;
    }

    has(primitiveId) {
        return this._primitives.has(primitiveId);
    }

    getAll() {
        return Array.from(this._primitives.values());
    }

    getConcrete() {
        return this.getAll().filter(p => !p.is_abstract);
    }

    getAbstract() {
        return this.getAll().filter(p => p.is_abstract);
    }

    getByCategory(category) {
        return this._categoryIndex.get(category) || [];
    }

    getByFamily(family) {
        return this._familyIndex.get(family) || [];
    }

    getByAction(action) {
        return this._actionIndex.get(action) || [];
    }

    getByTag(tag) {
        return this.getAll().filter(p => p.tags.includes(tag));
    }

    size() {
        return this._primitives.size;
    }

    toCatalogJSON() {
        return this.getAll().map(p => p.toJSON());
    }
}

// Singleton default registry instance
let _defaultRegistry = null;
function getDefaultRegistry() {
    if (!_defaultRegistry) {
        _defaultRegistry = new PrimitiveRegistry();
    }
    return _defaultRegistry;
}

module.exports = {
    PrimitiveRegistry,
    getDefaultRegistry
};
