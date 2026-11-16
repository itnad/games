import { checksum } from "../core/checksum";
import original from "../data/medic-original.json";
export const MEDIC = "terran-medic", HEALING = "healing";
export const MEDIC_HEALING = original.healing;
export const MEDIC_RULES_VERSION = "medic-1-" + checksum({original:JSON.stringify(original),auto:"nearest5-nearside-visible-frontline-budget8-per5",manual:"follow-until-complete",orders:"manual20-hold-no-approach",frames:"interleave-medic-regen-healing",recall:"cancel-job"});
const organic = new Set(original.organicUnits);
export const isOrganic = (definition:string) => organic.has(definition);
