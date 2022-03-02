import { AssetMeta, DataSource } from "./dataSource";
import { Reporter, SizeChange } from "./reporter";

// only include relative size changes exceeding (0.01%)
const RELATIVE_CHANGE_THRESHOLD = 0.0001;

export class Comparator {
    private source: DataSource;
    private reporter: Reporter;
    private threshold: number;

    constructor(source: DataSource, reporter: Reporter, threshold: number = RELATIVE_CHANGE_THRESHOLD) {
        this.source = source;
        this.reporter = reporter;
        this.threshold = threshold;
    }

    async compare(baseVersion: string, changedVersion: string): Promise<SizeChange[]> {
        const sizeChanges = await this.fetchMetasAndCompare(baseVersion, changedVersion);
        this.reportSignificantSizeChanges(sizeChanges);
        return sizeChanges;
    }

    async compareLatestVersions(): Promise<SizeChange[]> {
        const latestVersions = await this.source.getLatestVersions();
        console.log("latest versions:", latestVersions);
        const sizeChanges = [];
        for (const version of latestVersions) {
            const previous = await this.source.getPreviousVersion(version);
            if (previous) {
                sizeChanges.push(...(await this.fetchMetasAndCompare(previous, version)));
            }
        }
        this.reportSignificantSizeChanges(sizeChanges);
        return sizeChanges;
    }

    private reportSignificantSizeChanges(sizeChanges: SizeChange[]) {
        const filtered = sizeChanges.filter(({ relative }) => Math.abs(relative) > this.threshold);
        filtered.sort((a, b) => b.relative - a.relative); // sort by significance
        if (filtered.length > 0) {
            this.reporter.report(filtered);
            console.log(`reported ${filtered.length} size changes`);
        } else {
            console.log("no size changes to report");
        }
    }

    private async fetchMetasAndCompare(baseVersion: string, changedVersion: string): Promise<SizeChange[]> {
        const baseMetas = await this.source.getAssetMetas(baseVersion);
        const changedMetas = await this.source.getAssetMetas(changedVersion);
        const comparableMetas = baseMetas
            .map((base) => ({ base, changed: changedMetas.find((m) => m.targetPlatform === base.targetPlatform) }))
            .filter(({ changed }) => !!changed) as { base: AssetMeta; changed: AssetMeta }[];

        return comparableMetas.map(({ base, changed }) => ({
            absolute: changed.sizeInBytes - base.sizeInBytes,
            base,
            changed,
            relative: (changed.sizeInBytes - base.sizeInBytes) / base.sizeInBytes,
        }));
    }
}