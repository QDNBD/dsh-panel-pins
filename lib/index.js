/**
 * dsh-panel-pins — host half (no-op).
 *
 * The bundle only needs a host-side plugin so Cordis accepts the package; all
 * real work happens in the browser half (lib/client.js).
 */
export const name = 'panel-pins'
export const inject = []
export function apply() {}
