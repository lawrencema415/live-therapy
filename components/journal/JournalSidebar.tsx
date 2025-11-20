'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { Home, LayoutDashboard, BookOpen, LogOut } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';

export function JournalSidebar() {
	const pathname = usePathname();
	const router = useRouter();
	const { signOut } = useAuth();

	const handleLogout = async () => {
		try {
			await signOut();
			router.push('/');
		} catch (error) {
			console.error('Failed to sign out:', error);
		}
	};

	const navItems = [
		{
			href: '/therapy',
			label: 'Therapy',
			icon: Home,
		},
		{
			href: '/dashboard',
			label: 'Dashboard',
			icon: LayoutDashboard,
		},
		{
			href: '/journal',
			label: 'Journal',
			icon: BookOpen,
		},
	];

	return (
		<div className='w-64 shrink-0 bg-white border-r border-slate-200 flex flex-col'>
			{/* Logo/Brand */}
			<div className='px-6 py-4 border-b border-slate-200'>
				<h2 className='text-xl font-bold text-slate-800'>LiveTherapy</h2>
			</div>

			{/* Navigation */}
			<nav className='flex-1 px-4 py-4'>
				<ul className='space-y-1'>
					{navItems.map((item) => {
						const Icon = item.icon;
						const isActive = pathname === item.href || pathname?.startsWith(item.href + '/');
						return (
							<li key={item.href}>
								<Link
									href={item.href}
									className={`flex items-center gap-3 px-3 py-2.5 rounded-lg transition-all duration-200 cursor-pointer ${
										isActive
											? 'bg-blue-50 text-blue-700 font-medium'
											: 'text-slate-700 hover:bg-slate-50 active:bg-slate-100'
									} focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-1`}
								>
									<Icon size={20} />
									<span>{item.label}</span>
								</Link>
							</li>
						);
					})}
				</ul>
			</nav>

			{/* Logout */}
			<div className='px-4 py-4 border-t border-slate-200'>
				<button
					onClick={handleLogout}
					className='flex items-center gap-3 px-3 py-2.5 rounded-lg text-slate-700 hover:bg-slate-50 active:bg-slate-100 transition-all duration-200 w-full cursor-pointer focus:outline-none focus:ring-2 focus:ring-slate-500 focus:ring-offset-1'
					aria-label='Logout'
				>
					<LogOut size={20} />
					<span>Logout</span>
				</button>
			</div>
		</div>
	);
}

