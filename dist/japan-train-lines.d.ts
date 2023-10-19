export function drawTrainLine(companyName: any, lineName: any, viewerEl: any, width?: number): void;
export function loadTrainLines({ railroadGeoJsonUrl }: {
    railroadGeoJsonUrl: any;
}): Promise<{
    trainLines: {};
    trainCompanyNames: {
        company: string;
        lines: string[];
    }[];
}>;
