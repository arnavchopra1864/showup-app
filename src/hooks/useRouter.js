import { useState } from "react";

export function useRouter() {
  const [stack, setStack] = useState([{ screen: "home", params: {} }]);
  const current = stack[stack.length - 1];

  const push = (screen, params = {}) =>
    setStack(s => [...s, { screen, params, direction: "forward" }]);

  const pop = () =>
    setStack(s => s.length > 1 ? s.slice(0, -1) : s);

  const replace = (screen, params = {}) =>
    setStack(s => [...s.slice(0, -1), { screen, params, direction: "replace" }]);

  const resetTo = (screen, params = {}) =>
    setStack([{ screen, params }]);

  return { current, push, pop, replace, resetTo, canGoBack: stack.length > 1 };
}
