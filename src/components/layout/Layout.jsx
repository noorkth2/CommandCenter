import { Outlet } from 'react-router-dom';
import Sidebar from './Sidebar';
import TopBar from './TopBar';

/**
 * Root layout shell — fixed sidebar + top bar + scrollable content area.
 */
export default function Layout() {
  return (
    <div className="app-layout">
      <Sidebar />
      <TopBar />
      <main className="main-content" id="main-content">
        <div className="p-6 max-w-[1200px] mx-auto">
          <Outlet />
        </div>
      </main>
    </div>
  );
}
