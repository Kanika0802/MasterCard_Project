// attack-primitives/src/registry/CatalogExporter.js
"use strict";

const { getDefaultRegistry } = require("./PrimitiveRegistry");

class CatalogExporter {
    constructor(registry = getDefaultRegistry()) {
        this.registry = registry;
    }

    /**
     * Export a compact schema representation designed specifically for M4 LLM prompt context injection
     */
    exportForLLMPrompt(options = { concreteOnly: true }) {
        const primitives = options.concreteOnly ? this.registry.getConcrete() : this.registry.getAll();

        return primitives.map(p => ({
            id: p.primitive_id,
            name: p.name,
            description: p.description,
            category: p.category,
            family: p.attack_family,
            simulator_action: p.simulator_action,
            parameters: p.parameters.map(param => ({
                name: param.name,
                type: param.type,
                required: param.required,
                description: param.description,
                default: param.default_value,
                enum: param.enum_values
            })),
            expected_events: p.expected_success_events
        }));
    }

    /**
     * Export complete catalog JSON bundle
     */
    exportBundle() {
        return {
            schema_version: "1.0.0",
            exported_at: new Date().toISOString(),
            total_primitives: this.registry.size(),
            primitives: this.registry.toCatalogJSON()
        };
    }

    /**
     * Export Markdown formatted catalog documentation
     */
    exportMarkdown() {
        const lines = [
            "# Attack Primitive Library Catalog",
            "",
            `Total Primitives: ${this.registry.size()}`,
            "",
            "| ID | Name | Category | Family | Exec Type | Simulator Action | Severity |",
            "|---|---|---|---|---|---|---|"
        ];

        for (const p of this.registry.getAll()) {
            lines.push(
                `| \`${p.primitive_id}\` | ${p.name} | ${p.category} | ${p.attack_family} | ${p.execution_type} | \`${p.simulator_action || "NONE"}\` | ${p.financial_impact_severity} |`
            );
        }

        return lines.join("\n");
    }
}

module.exports = CatalogExporter;
