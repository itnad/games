import { validatePersistenceEnvelope, type PersistenceEnvelope } from "../core/state";
/** The UI and save consumers never own the only verified recovery copy. */
export class CheckpointStore {
  private latest: PersistenceEnvelope | null = null;
  save(snapshot: unknown): boolean {
    const parsed = validatePersistenceEnvelope(snapshot);
    if (!parsed.ok) return false;
    this.latest = structuredClone(parsed.value); return true;
  }
  read(): PersistenceEnvelope | null { return this.latest && structuredClone(this.latest); }
  clear(): void { this.latest = null; }
}
