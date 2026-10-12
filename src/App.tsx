import { useEffect } from 'react';
import { onDataChanged, useStore } from './store';
import { scheduleAutoBackup } from './drive';
import { useRoute } from './router';
import { ListScreen } from './screens/ListScreen';
import { AddScreen } from './screens/AddScreen';
import { SongScreen } from './screens/SongScreen';
import { RandomScreen } from './screens/RandomScreen';
import { RecordsScreen } from './screens/RecordsScreen';
import { SettingsScreen, useBackupReminder } from './screens/SettingsScreen';
import { Icon, ToastHost, toast } from './components/ui';

const TABS = [
  { path: '', icon: 'list', label: '持ち歌' },
  { path: 'add', icon: 'plus', label: '追加' },
  { path: 'random', icon: 'dice', label: 'おまかせ' },
  { path: 'records', icon: 'chart', label: '記録' },
  { path: 'settings', icon: 'gear', label: '設定' },
];

export function App() {
  const { ready } = useStore();
  const route = useRoute();
  const remind = useBackupReminder();

  useEffect(
    () =>
      onDataChanged(() =>
        scheduleAutoBackup((err) => {
          if (err) toast('自動バックアップに失敗。設定から接続し直してね');
        }),
      ),
    [],
  );

  if (!ready) return <div className="boot">読み込み中…</div>;

  const [head, id, sub] = route;
  let screen;
  switch (head) {
    case undefined:
      screen = <ListScreen />;
      break;
    case 'add':
      screen = <AddScreen />;
      break;
    case 'random':
      screen = <RandomScreen />;
      break;
    case 'records':
      screen = <RecordsScreen />;
      break;
    case 'settings':
      screen = <SettingsScreen />;
      break;
    case 'song':
      screen = <SongScreen key={id} id={id} edit={sub === 'edit'} />;
      break;
    default:
      screen = <ListScreen />;
  }

  const activeTab = head === 'song' ? '' : head ?? '';

  return (
    <>
      <main>{screen}</main>
      <nav className="bottom-nav" aria-label="メインメニュー">
        {TABS.map((t) => (
          <a key={t.path} href={`#/${t.path}`} className={activeTab === t.path ? 'on' : ''} aria-current={activeTab === t.path ? 'page' : undefined}>
            <span className="nav-icon">
              <Icon name={t.icon} size={22} />
              {t.path === 'settings' && remind && <i className="dot" aria-label="バックアップ未実施" />}
            </span>
            <span>{t.label}</span>
          </a>
        ))}
      </nav>
      <ToastHost />
    </>
  );
}
