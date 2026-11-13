export default function getNavigation() {
  try {
    const navigation = window.navigation;
    return typeof navigation?.navigate === 'function' ? navigation : undefined;
  } catch {
    return undefined;
  }
}
