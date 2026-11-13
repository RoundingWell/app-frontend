// Main-app pages use pathnames; query and fragment changes stay in the same view.
export default function trackNativeViews(navigation, startView) {
  const onEntryChange = ({ from }) => {
    if (new URL(from.url).pathname === new URL(navigation.currentEntry.url).pathname) return;

    startView();
  };
  const onPageShow = ({ persisted }) => {
    if (persisted) startView();
  };

  navigation.addEventListener('currententrychange', onEntryChange);
  window.addEventListener('pageshow', onPageShow, true);
  // Manual SDK tracking waits for its first explicit view before starting RUM.
  startView();

  return () => {
    navigation.removeEventListener('currententrychange', onEntryChange);
    window.removeEventListener('pageshow', onPageShow, true);
  };
}
