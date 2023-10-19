/** @typedef {typeof __propDef.props}  JapanTrainLinesProps */
/** @typedef {typeof __propDef.events}  JapanTrainLinesEvents */
/** @typedef {typeof __propDef.slots}  JapanTrainLinesSlots */
export default class JapanTrainLines extends SvelteComponent<{
    railroadGeoJsonUrl?: string;
}, {
    [evt: string]: CustomEvent<any>;
}, {}> {
}
export type JapanTrainLinesProps = typeof __propDef.props;
export type JapanTrainLinesEvents = typeof __propDef.events;
export type JapanTrainLinesSlots = typeof __propDef.slots;
import { SvelteComponent } from "svelte";
declare const __propDef: {
    props: {
        railroadGeoJsonUrl?: string;
    };
    events: {
        [evt: string]: CustomEvent<any>;
    };
    slots: {};
};
export {};
