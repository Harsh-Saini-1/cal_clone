import Navbar from '@/components/layout/Navbar';

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="dashboard-shell">
      <Navbar />
      <main className="dashboard-main">{children}</main>
    </div>
  );
}
