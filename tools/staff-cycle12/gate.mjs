// Deliberate test intervention, not transparent observation or a runtime correction.
export function installNavigationGate(target, record, stack = () => String(new Error().stack || '')) {
 const nativeSet = target.setTimeout, nativeClear = target.clearTimeout;
 let captured = null, used = false, released = false;
 const emit = kind => record({kind, time: Date.now()});
 target.setTimeout = function(callback, delay, ...args) {
  const selected = !used && target.location.pathname === '/staff-forms.html' &&
   typeof callback === 'function' && callback.name === 'leave' && delay === 0 &&
   /https:\/\/module-cycle8\.invalid\/assets\/js\/staff-session\.js:\d+:\d+/.test(stack());
  if (!selected) return Reflect.apply(nativeSet, this, [callback, delay, ...args]);
  used = true;
  // The native timer ID remains cancellable. Its callback waits at the gate.
  const timer = Reflect.apply(nativeSet, this, [function(...forwarded) {
   captured = {callback, receiver: this, args: forwarded}; emit('leave-ready');
  }, delay, ...args]);
  emit('leave-selected');
  Reflect.apply(nativeSet, target, [() => {
   if (!released) { emit('gate-timeout'); target.__cycle12Gate.release(); }
  }, 6000]);
  return timer;
 };
 target.clearTimeout = function(...args) { return Reflect.apply(nativeClear, this, args); };
 const api = {
  get ready() { return !!captured; },
  release() {
   if (!captured || released) return false;
   released = true; const {callback, receiver, args} = captured;
   emit('leave-release');
   Reflect.apply(nativeSet, target, [() => Reflect.apply(callback, receiver, args), 0]);
   return true;
  }
 };
 target.__cycle12Gate = api;
 return api;
}
