// 링크용 빌드에서 cdnjs의 React UMD 전역을 자동 JSX 런타임처럼 쓰게 하는 얇은 연결 코드.
const React = window.React;
export const Fragment = React.Fragment;
export function jsx(type, props, key) {
  const { children, ...rest } = props ?? {};
  if (key !== undefined) rest.key = key;
  return children === undefined ? React.createElement(type, rest) : React.createElement(type, rest, children);
}
export function jsxs(type, props, key) {
  const { children, ...rest } = props ?? {};
  if (key !== undefined) rest.key = key;
  return React.createElement(type, rest, ...(Array.isArray(children) ? children : [children]));
}
