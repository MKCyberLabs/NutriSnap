export interface NavItem {
  key: string;
  label: string;
  path: string;
  iconName: 'Calendar' | 'Utensils' | 'Droplets' | 'Wallet' | 'Bell';
  description?: string;
}

export const MODULE_REGISTRY: NavItem[] = [
  { key: 'today', label: 'Today', path: '/today', iconName: 'Calendar', description: 'Daily Health & Wealth overview' },
  { key: 'food', label: 'Food', path: '/dashboard', iconName: 'Utensils', description: 'Meal logging & nutrition analysis' },
  { key: 'water', label: 'Water', path: '/hydration', iconName: 'Droplets', description: 'Hydration tracking & water goals' },
  { key: 'money', label: 'Money', path: '/finance', iconName: 'Wallet', description: 'Accounts, income, expenses & transfers' },
  { key: 'reminders', label: 'Reminders', path: '/reminders', iconName: 'Bell', description: 'Health & finance schedules' },
];
