import data from "../../mission-templates.json";

type FieldDef = {
	label: string;
	placeholder: string;
	required: boolean;
};

export type MissionTemplate = {
	id: string;
	code: string;
	name: string;
	description: string;
	callsign_pattern: string;
	fields: Record<string, FieldDef>;
	default_visibility: "public" | "authenticated" | "participants";
	default_roles: {
		creator: "commander" | "crew";
		participant: "commander" | "crew";
	};
};

const templates = data.templates as MissionTemplate[];
const templateMap = new Map<string, MissionTemplate>(templates.map((t) => [t.id, t]));

export function getTemplate(id: string): MissionTemplate | undefined {
	return templateMap.get(id);
}

export function getAllTemplates(): MissionTemplate[] {
	return templates;
}

/**
 * Generate a callsign from a template pattern and parameters.
 *
 * Supported placeholders:
 *  - {hour} — hour from scheduled_at (e.g., "5" for 05:00)
 *  - {seq}  — falls through to sequential numbering
 */
export function generateCallsign(pattern: string, params: { hour?: number; seq?: number }): string {
	let result = pattern;
	if (params.hour !== undefined) {
		result = result.replace("{hour}", String(params.hour));
	}
	if (params.seq !== undefined) {
		result = result.replace("{seq}", String(params.seq).padStart(3, "0"));
	}
	return result;
}
