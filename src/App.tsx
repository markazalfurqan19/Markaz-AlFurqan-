import React, { useEffect, useMemo, useState } from 'react';
import { onAuthStateChanged, signOut, User } from 'firebase/auth';
import {
  collection,
  deleteDoc,
  doc,
  getDoc,
  onSnapshot,
  query,
  setDoc,
  updateDoc,
  where,
} from 'firebase/firestore';
import {
  BarChart3,
  CreditCard,
  FileSpreadsheet,
  LayoutDashboard,
  LogOut,
  Menu,
  Moon,
  Plus,
  Settings,
  Sun,
  Users,
  WifiOff,
  X,
} from 'lucide-react';
import { auth, db, handleFirestoreError, OperationType } from './firebase';
import {
  AdminRole,
  AdminRoleType,
  CenterSetting,
  Contribution,
  HARDCODED_OWNER_EMAILS,
  Member,
  SCHEMA_LIMITS,
  getCurrentEthiopianDate,
  sanitizeDocId,
} from './types';
import { Language, TRANSLATIONS } from './i18n';
import { useOnlineStatus } from './hooks/useOnlineStatus';
import { ErrorBoundary } from './components/ErrorBoundary';
import { AuthGate } from './components/AuthGate';
import { PWAInstallButton } from './components/PWAInstallButton';
import { DashboardView } from './components/DashboardView';
import { MembersView } from './components/MembersView';
import { ContributionsView } from './components/ContributionsView';
import { ReportsView } from './components/ReportsView';
import { SettingsView } from './components/SettingsView';
import { MemberModal } from './components/MemberModal';
import { ContributionModal } from './components/ContributionModal';
import { GoogleSheetsSyncModal } from './components/GoogleSheetsSyncModal';
import { PullSyncPreview } from './utils/googleSheetsSync';

type ActiveTab = 'dashboard' | 'members' | 'contributions' | 'reports' | 'settings';

function AppContent() {
  const [user, setUser] = useState<User | null>(null);
  const [authReady, setAuthReady] = useState(false);

  const [roleResolved, setRoleResolved] = useState(false);
  const [isOwner, setIsOwner] = useState(false);
  const [isAdmin, setIsAdmin] = useState(false);

  const [members, setMembers] = useState<Member[]>([]);
  const [contributions, setContributions] = useState<Contribution[]>([]);
  const [admins, setAdmins] = useState<AdminRole[]>([]);
  const [dataLoading, setDataLoading] = useState(true);

  const [lang, setLang] = useState<Language>(() => {
    const saved = localStorage.getItem('alfurqaan_lang');
    return saved === 'en' ? 'en' : 'om';
  });
  const [darkMode, setDarkMode] = useState<boolean>(() => {
    return localStorage.getItem('alfurqaan_theme') === 'dark';
  });

  const [centerSettings, setCenterSettings] = useState<CenterSetting>({
    centerName: TRANSLATIONS.om.centerDefaultName,
    phone: '',
    email: 'markazalfurqan19@gmail.com',
    bankAccountDetails: '',
    monthlyTargetETB: 50000,
  });

  const [activeTab, setActiveTab] = useState<ActiveTab>('dashboard');
  const [mobileNavOpen, setMobileNavOpen] = useState(false);

  // Modals
  const [memberModalOpen, setMemberModalOpen] = useState(false);
  const [editingMember, setEditingMember] = useState<Member | null>(null);

  const [contributionModalOpen, setContributionModalOpen] = useState(false);
  const [editingContribution, setEditingContribution] = useState<Contribution | null>(null);
  const [preselectedMember, setPreselectedMember] = useState<Member | null>(null);
  const [sheetsModalOpen, setSheetsModalOpen] = useState(false);

  const isOnline = useOnlineStatus();
  const t = TRANSLATIONS[lang];

  useEffect(() => {
    localStorage.setItem('alfurqaan_lang', lang);
  }, [lang]);

  useEffect(() => {
    const root = document.documentElement;
    if (darkMode) {
      root.classList.add('dark');
      localStorage.setItem('alfurqaan_theme', 'dark');
    } else {
      root.classList.remove('dark');
      localStorage.setItem('alfurqaan_theme', 'light');
    }
  }, [darkMode]);

  // 1. Auth Listener
  useEffect(() => {
    const unsub = onAuthStateChanged(auth, (firebaseUser) => {
      setUser(firebaseUser);
      setAuthReady(true);
      if (!firebaseUser) {
        setRoleResolved(false);
        setIsOwner(false);
        setIsAdmin(false);
        setMembers([]);
        setContributions([]);
        setAdmins([]);
      }
    });
    return () => unsub();
  }, []);

  // 2. Role Resolution (runs once auth is ready and user is signed in)
  useEffect(() => {
    if (!authReady || !user) return;
    const currentUser = user;
    let active = true;
    const email = (currentUser.email || '').toLowerCase();

    async function checkRoles() {
      const hardcoded = (HARDCODED_OWNER_EMAILS as readonly string[]).includes(email);
      if (hardcoded) {
        if (active) {
          setIsOwner(true);
          setIsAdmin(true);
          setRoleResolved(true);
        }
        return;
      }

      try {
        const byEmailSnap = email ? await getDoc(doc(db, 'admins', email)) : null;
        const byUidSnap = await getDoc(doc(db, 'admins', currentUser.uid));
        const roleData =
          (byEmailSnap?.exists() ? (byEmailSnap.data() as AdminRole) : null) ||
          (byUidSnap.exists() ? (byUidSnap.data() as AdminRole) : null);

        if (active) {
          const ownerFlag = roleData?.role === 'owner';
          const adminFlag = ownerFlag || roleData?.role === 'admin';
          setIsOwner(ownerFlag);
          setIsAdmin(adminFlag);
          setRoleResolved(true);
        }
      } catch {
        if (active) {
          setIsOwner(false);
          setIsAdmin(false);
          setRoleResolved(true);
        }
      }
    }

    void checkRoles();
    return () => {
      active = false;
    };
  }, [authReady, user]);

  // 3. Firestore Real-Time Listeners (strictly after authReady && user && roleResolved)
  useEffect(() => {
    if (!authReady || !user || !roleResolved) return;
    setDataLoading(true);

    const membersQuery = isAdmin
      ? collection(db, 'members')
      : query(collection(db, 'members'), where('createdBy', '==', user.uid));

    const contributionsQuery = isAdmin
      ? collection(db, 'contributions')
      : query(collection(db, 'contributions'), where('recordedBy', '==', user.uid));

    let membersLoaded = false;
    let contribLoaded = false;
    const checkDone = () => {
      if (membersLoaded && contribLoaded) setDataLoading(false);
    };

    const unsubMembers = onSnapshot(
      membersQuery,
      (snap) => {
        const list: Member[] = snap.docs.map((d) => ({
          ...(d.data() as Omit<Member, 'id'>),
          id: d.id,
        }));
        list.sort((a, b) => a.memberId.localeCompare(b.memberId));
        setMembers(list);
        membersLoaded = true;
        checkDone();
      },
      (error) => handleFirestoreError(error, OperationType.LIST, 'members')
    );

    const unsubContributions = onSnapshot(
      contributionsQuery,
      (snap) => {
        const list: Contribution[] = snap.docs.map((d) => ({
          ...(d.data() as Omit<Contribution, 'id'>),
          id: d.id,
        }));
        setContributions(list);
        contribLoaded = true;
        checkDone();
      },
      (error) => handleFirestoreError(error, OperationType.LIST, 'contributions')
    );

    const unsubSettings = onSnapshot(
      doc(db, 'settings', 'center'),
      (snap) => {
        if (snap.exists()) {
          const data = snap.data() as CenterSetting;
          setCenterSettings({
            centerName: data.centerName || TRANSLATIONS.om.centerDefaultName,
            phone: data.phone || '',
            email: data.email || '',
            bankAccountDetails: data.bankAccountDetails || '',
            monthlyTargetETB: data.monthlyTargetETB ?? 50000,
            googleSpreadsheetId: data.googleSpreadsheetId || '',
            googleSpreadsheetTitle: data.googleSpreadsheetTitle || '',
            googleSpreadsheetUrl: data.googleSpreadsheetUrl || '',
            googleLastSyncAt: data.googleLastSyncAt || '',
          });
        }
      },
      (error) => handleFirestoreError(error, OperationType.GET, 'settings/center')
    );

    let unsubAdmins: (() => void) | undefined;
    if (isOwner) {
      unsubAdmins = onSnapshot(
        collection(db, 'admins'),
        (snap) => {
          const list: AdminRole[] = snap.docs.map((d) => ({
            ...(d.data() as Omit<AdminRole, 'id'>),
            id: d.id,
          }));
          setAdmins(list);
        },
        (error) => handleFirestoreError(error, OperationType.LIST, 'admins')
      );
    }

    return () => {
      unsubMembers();
      unsubContributions();
      unsubSettings();
      if (unsubAdmins) unsubAdmins();
    };
  }, [authReady, user, roleResolved, isAdmin, isOwner]);

  const suggestedMemberCode = useMemo(() => {
    const nextNum = members.length + 1;
    return `ALF-M-${String(nextNum).padStart(3, '0')}`;
  }, [members.length]);

  const suggestedReceiptNo = useMemo(() => {
    const { year } = getCurrentEthiopianDate();
    const nextSeq = contributions.length + 1;
    return `ALF-REC-${year}-${String(nextSeq).padStart(4, '0')}`;
  }, [contributions.length]);

  // Firestore Mutations
  const handleSaveMember = async (
    data: Omit<Member, 'id' | 'halqa' | 'createdBy' | 'createdByEmail' | 'createdAt' | 'updatedAt'>
  ) => {
    if (!user) return;
    const now = new Date().toISOString();

    if (editingMember) {
      const path = `members/${editingMember.id}`;
      try {
        await updateDoc(doc(db, 'members', editingMember.id), {
          fullName: data.fullName,
          phoneNumber: data.phoneNumber,
          email: data.email || '',
          monthlyPledgeETB: data.monthlyPledgeETB,
          status: data.status,
          city: data.city || '',
          updatedAt: now,
        });
      } catch (err) {
        handleFirestoreError(err, OperationType.UPDATE, path);
      }
    } else {
      const docId = sanitizeDocId(`${data.memberId}-${Date.now().toString(36)}`);
      const path = `members/${docId}`;
      try {
        await setDoc(doc(db, 'members', docId), {
          fullName: data.fullName,
          phoneNumber: data.phoneNumber,
          email: data.email || '',
          memberId: data.memberId,
          monthlyPledgeETB: data.monthlyPledgeETB,
          status: data.status,
          city: data.city || '',
          createdBy: user.uid,
          createdByEmail: (user.email || '').slice(0, SCHEMA_LIMITS.ADMIN_EMAIL),
          createdAt: now,
          updatedAt: now,
        });
      } catch (err) {
        handleFirestoreError(err, OperationType.CREATE, path);
      }
    }
  };

  const handleDeleteMember = async (member: Member) => {
    const path = `members/${member.id}`;
    try {
      await deleteDoc(doc(db, 'members', member.id));
    } catch (err) {
      handleFirestoreError(err, OperationType.DELETE, path);
    }
  };

  const handleSaveContribution = async (
    data: Omit<Contribution, 'id' | 'recordedBy' | 'createdAt' | 'updatedAt'>
  ) => {
    if (!user) return;
    const now = new Date().toISOString();

    if (editingContribution) {
      const path = `contributions/${editingContribution.id}`;
      try {
        await updateDoc(doc(db, 'contributions', editingContribution.id), {
          amountETB: data.amountETB,
          ethiopianMonth: data.ethiopianMonth,
          ethiopianYear: data.ethiopianYear,
          paymentMethod: data.paymentMethod,
          transactionReference: data.transactionReference || '',
          notes: data.notes || '',
          status: data.status,
          updatedAt: now,
        });
      } catch (err) {
        handleFirestoreError(err, OperationType.UPDATE, path);
      }
    } else {
      const docId = sanitizeDocId(`${data.receiptNumber}-${Date.now().toString(36)}`);
      const path = `contributions/${docId}`;
      try {
        await setDoc(doc(db, 'contributions', docId), {
          memberId: data.memberId,
          memberName: data.memberName,
          receiptNumber: data.receiptNumber,
          amountETB: data.amountETB,
          ethiopianMonth: data.ethiopianMonth,
          ethiopianYear: data.ethiopianYear,
          paymentMethod: data.paymentMethod,
          transactionReference: data.transactionReference || '',
          notes: data.notes || '',
          recordedBy: user.uid,
          status: data.status,
          createdAt: now,
          updatedAt: now,
        });
      } catch (err) {
        handleFirestoreError(err, OperationType.CREATE, path);
      }
    }
  };

  const handleQuickVerifyContribution = async (c: Contribution) => {
    const path = `contributions/${c.id}`;
    try {
      await updateDoc(doc(db, 'contributions', c.id), {
        status: 'verified',
        updatedAt: new Date().toISOString(),
      });
    } catch (err) {
      handleFirestoreError(err, OperationType.UPDATE, path);
    }
  };

  const handleDeleteContribution = async (c: Contribution) => {
    const path = `contributions/${c.id}`;
    try {
      await deleteDoc(doc(db, 'contributions', c.id));
    } catch (err) {
      handleFirestoreError(err, OperationType.DELETE, path);
    }
  };

  const handleSaveSettings = async (data: CenterSetting) => {
    if (!user) return;
    const path = 'settings/center';
    try {
      await setDoc(doc(db, 'settings', 'center'), {
        centerName: data.centerName,
        phone: data.phone || '',
        email: data.email || '',
        bankAccountDetails: data.bankAccountDetails || '',
        monthlyTargetETB: data.monthlyTargetETB ?? 0,
        googleSpreadsheetId: (
          data.googleSpreadsheetId ?? centerSettings.googleSpreadsheetId ?? ''
        ).slice(0, SCHEMA_LIMITS.SETTING_SHEET_ID),
        googleSpreadsheetTitle: (
          data.googleSpreadsheetTitle ?? centerSettings.googleSpreadsheetTitle ?? ''
        ).slice(0, SCHEMA_LIMITS.SETTING_SHEET_TITLE),
        googleSpreadsheetUrl: (
          data.googleSpreadsheetUrl ?? centerSettings.googleSpreadsheetUrl ?? ''
        ).slice(0, SCHEMA_LIMITS.SETTING_SHEET_URL),
        googleLastSyncAt: (
          data.googleLastSyncAt ?? centerSettings.googleLastSyncAt ?? ''
        ).slice(0, 64),
        updatedBy: user.uid,
        updatedAt: new Date().toISOString(),
      });
    } catch (err) {
      handleFirestoreError(err, OperationType.WRITE, path);
    }
  };

  const handleSaveSheetSettings = async (patch: Partial<CenterSetting>) => {
    await handleSaveSettings({
      ...centerSettings,
      ...patch,
    });
  };

  const handleImportFromSheet = async (preview: PullSyncPreview) => {
    if (!user) {
      return { membersAdded: 0, membersUpdated: 0, contributionsAdded: 0 };
    }
    const now = new Date().toISOString();
    let membersAdded = 0;
    let membersUpdated = 0;
    let contributionsAdded = 0;

    for (const draft of preview.newMembers) {
      const docId = sanitizeDocId(`${draft.memberId}-${Date.now().toString(36)}-${membersAdded}`);
      const path = `members/${docId}`;
      try {
        await setDoc(doc(db, 'members', docId), {
          fullName: draft.fullName.slice(0, SCHEMA_LIMITS.MEMBER_FULL_NAME),
          phoneNumber: draft.phoneNumber.slice(0, SCHEMA_LIMITS.MEMBER_PHONE),
          email: draft.email.slice(0, SCHEMA_LIMITS.MEMBER_EMAIL),
          memberId: draft.memberId.slice(0, SCHEMA_LIMITS.MEMBER_CODE),
          monthlyPledgeETB: draft.monthlyPledgeETB,
          status: draft.status,
          city: draft.city.slice(0, SCHEMA_LIMITS.MEMBER_CITY),
          createdBy: user.uid,
          createdByEmail: (user.email || '').slice(0, SCHEMA_LIMITS.ADMIN_EMAIL),
          createdAt: now,
          updatedAt: now,
        });
        membersAdded += 1;
      } catch (err) {
        handleFirestoreError(err, OperationType.CREATE, path);
      }
    }

    for (const draft of preview.updatedMembers) {
      if (!draft.existingDocId) continue;
      const path = `members/${draft.existingDocId}`;
      try {
        await updateDoc(doc(db, 'members', draft.existingDocId), {
          fullName: draft.fullName.slice(0, SCHEMA_LIMITS.MEMBER_FULL_NAME),
          phoneNumber: draft.phoneNumber.slice(0, SCHEMA_LIMITS.MEMBER_PHONE),
          email: draft.email.slice(0, SCHEMA_LIMITS.MEMBER_EMAIL),
          monthlyPledgeETB: draft.monthlyPledgeETB,
          status: draft.status,
          city: draft.city.slice(0, SCHEMA_LIMITS.MEMBER_CITY),
          updatedAt: now,
        });
        membersUpdated += 1;
      } catch (err) {
        handleFirestoreError(err, OperationType.UPDATE, path);
      }
    }

    for (const draft of preview.newContributions) {
      const docId = sanitizeDocId(
        `${draft.receiptNumber}-${Date.now().toString(36)}-${contributionsAdded}`
      );
      const path = `contributions/${docId}`;
      try {
        await setDoc(doc(db, 'contributions', docId), {
          memberId: draft.memberId.slice(0, SCHEMA_LIMITS.CONTRIBUTION_MEMBER_ID),
          memberName: draft.memberName.slice(0, SCHEMA_LIMITS.CONTRIBUTION_MEMBER_NAME),
          receiptNumber: draft.receiptNumber.slice(0, SCHEMA_LIMITS.CONTRIBUTION_RECEIPT),
          amountETB: draft.amountETB,
          ethiopianMonth: draft.ethiopianMonth.slice(0, SCHEMA_LIMITS.CONTRIBUTION_MONTH),
          ethiopianYear: draft.ethiopianYear,
          paymentMethod: draft.paymentMethod,
          transactionReference: draft.transactionReference.slice(0, SCHEMA_LIMITS.CONTRIBUTION_TX_REF),
          notes: draft.notes.slice(0, SCHEMA_LIMITS.CONTRIBUTION_NOTES),
          recordedBy: user.uid,
          status: draft.status,
          createdAt: now,
          updatedAt: now,
        });
        contributionsAdded += 1;
      } catch (err) {
        handleFirestoreError(err, OperationType.CREATE, path);
      }
    }

    return { membersAdded, membersUpdated, contributionsAdded };
  };

  const handleGrantAdmin = async (email: string, role: AdminRoleType) => {
    if (!user) return;
    const cleanEmail = email.trim().toLowerCase().slice(0, SCHEMA_LIMITS.ADMIN_EMAIL);
    const path = `admins/${cleanEmail}`;
    try {
      await setDoc(doc(db, 'admins', cleanEmail), {
        email: cleanEmail,
        role,
        grantedBy: (user.email || user.uid).slice(0, SCHEMA_LIMITS.ADMIN_EMAIL),
        grantedAt: new Date().toISOString(),
      });
    } catch (err) {
      handleFirestoreError(err, OperationType.WRITE, path);
    }
  };

  const handleRevokeAdmin = async (adminId: string) => {
    const path = `admins/${adminId}`;
    try {
      await deleteDoc(doc(db, 'admins', adminId));
    } catch (err) {
      handleFirestoreError(err, OperationType.DELETE, path);
    }
  };

  if (!authReady) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#F6F8FC] dark:bg-[#060E1F]">
        <div className="w-8 h-8 rounded-full border-2 border-slate-300 dark:border-[#1B3158] border-t-[#1D4ED8] animate-spin" />
      </div>
    );
  }

  if (!user) {
    return (
      <AuthGate
        lang={lang}
        onToggleLang={() => setLang((prev) => (prev === 'om' ? 'en' : 'om'))}
      />
    );
  }

  const navItems: { id: ActiveTab; label: string; icon: React.ReactNode }[] = [
    { id: 'dashboard', label: t.nav.dashboard, icon: <LayoutDashboard className="w-4 h-4" /> },
    { id: 'members', label: t.nav.members, icon: <Users className="w-4 h-4" /> },
    { id: 'contributions', label: t.nav.contributions, icon: <CreditCard className="w-4 h-4" /> },
    { id: 'reports', label: t.nav.reports, icon: <BarChart3 className="w-4 h-4" /> },
    { id: 'settings', label: t.nav.settings, icon: <Settings className="w-4 h-4" /> },
  ];

  const roleLabel = isOwner ? t.roles.owner : isAdmin ? t.roles.admin : t.roles.recorder;

  const sidebarContent = (
    <div className="flex flex-col h-full justify-between bg-white dark:bg-[#0B1933] border-r border-slate-200 dark:border-[#1B3158]">
      <div className="p-5 space-y-6">
        {/* Brand */}
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-3 min-w-0">
            <img
              src="/assets/aistudio/loog_6003b99d.jpg"
              alt="Al-Furqaan Logo"
              className="w-10 h-10 rounded-full object-cover border border-slate-200 dark:border-[#1B3158] bg-white shrink-0"
            />
            <div className="min-w-0">
              <div className="text-sm font-bold text-slate-900 dark:text-white truncate">
                {t.appName}
              </div>
              <div className="text-[11px] text-slate-500 dark:text-slate-400 truncate">
                {t.appSubtitle}
              </div>
            </div>
          </div>
          <button
            type="button"
            onClick={() => setMobileNavOpen(false)}
            className="lg:hidden p-1.5 rounded-lg text-slate-500 hover:bg-slate-100 dark:hover:bg-[#13294E]"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Navigation */}
        <nav className="space-y-1">
          {navItems.map((item) => {
            const active = activeTab === item.id;
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => {
                  setActiveTab(item.id);
                  setMobileNavOpen(false);
                }}
                className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-xs font-semibold transition-colors whitespace-nowrap ${
                  active
                    ? 'bg-[#0B1F3A] text-white dark:bg-blue-700'
                    : 'text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-[#13294E]'
                }`}
              >
                {item.icon}
                <span>{item.label}</span>
              </button>
            );
          })}
        </nav>

        <PWAInstallButton label={t.actions.installApp} />
      </div>

      {/* Footer Controls */}
      <div className="p-4 border-t border-slate-200 dark:border-[#1B3158] space-y-3">
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setDarkMode((prev) => !prev)}
            className="flex-1 flex items-center justify-center gap-1.5 py-1.5 px-2 rounded-lg border border-slate-200 dark:border-[#1B3158] text-xs font-medium text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-[#13294E] whitespace-nowrap"
          >
            {darkMode ? <Sun className="w-3.5 h-3.5" /> : <Moon className="w-3.5 h-3.5" />}
            <span>{darkMode ? t.theme.deepBlue : t.theme.midnight}</span>
          </button>
          <button
            type="button"
            onClick={() => setLang((prev) => (prev === 'om' ? 'en' : 'om'))}
            className="px-3 py-1.5 rounded-lg border border-slate-200 dark:border-[#1B3158] text-xs font-semibold text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-[#13294E]"
          >
            {lang === 'om' ? 'EN' : 'OM'}
          </button>
        </div>

        <div className="flex items-center justify-between gap-2 pt-1">
          <div className="flex items-center gap-2.5 min-w-0">
            <img
              src="/assets/aistudio/loog_6003b99d.jpg"
              alt="Al-Furqaan Profile"
              className="w-8 h-8 rounded-full object-cover border border-slate-200 dark:border-slate-700 bg-white shrink-0"
            />
            <div className="min-w-0">
              <div className="text-xs font-semibold text-slate-900 dark:text-white truncate">
                {user.displayName || user.email}
              </div>
              <div className="text-[11px] text-slate-500 dark:text-slate-400 truncate">
                {roleLabel}
              </div>
            </div>
          </div>
          <button
            type="button"
            onClick={() => void signOut(auth)}
            title={t.actions.signOut}
            className="p-2 rounded-lg text-slate-500 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/40 shrink-0"
          >
            <LogOut className="w-4 h-4" />
          </button>
        </div>
      </div>
    </div>
  );

  return (
    <div className="min-h-screen flex bg-[#F6F8FC] dark:bg-[#060E1F] text-slate-900 dark:text-slate-100">
      {/* Desktop Sidebar */}
      <aside className="hidden lg:block w-64 shrink-0 sticky top-0 h-screen">
        {sidebarContent}
      </aside>

      {/* Mobile Drawer */}
      {mobileNavOpen && (
        <div className="fixed inset-0 z-50 lg:hidden flex">
          <div
            className="fixed inset-0 bg-slate-950/50"
            onClick={() => setMobileNavOpen(false)}
          />
          <div className="relative w-64 max-w-[80vw] h-full z-10">{sidebarContent}</div>
        </div>
      )}

      {/* Main Content */}
      <div className="flex-1 min-w-0 flex flex-col">
        {/* Top Bar Contract */}
        <header className="sticky top-0 z-30 bg-white/95 dark:bg-[#0B1933]/95 backdrop-blur-xs border-b border-slate-200 dark:border-[#1B3158] px-6 py-3.5 flex items-center justify-between gap-4">
          <div className="flex items-center gap-3 min-w-0">
            <button
              type="button"
              onClick={() => setMobileNavOpen(true)}
              className="lg:hidden p-2 rounded-lg border border-slate-200 dark:border-[#1B3158] text-slate-700 dark:text-slate-300"
            >
              <Menu className="w-4 h-4" />
            </button>
            <div className="flex items-center gap-2.5 text-sm min-w-0">
              <img
                src="/assets/aistudio/loog_6003b99d.jpg"
                alt="Al-Furqaan"
                className="w-7 h-7 rounded-full object-cover border border-slate-200 dark:border-[#1B3158] bg-white shrink-0 hidden sm:block"
              />
              <span className="font-semibold text-slate-400 dark:text-slate-500 truncate hidden sm:inline">
                {centerSettings.centerName}
              </span>
              <span className="text-slate-300 dark:text-slate-700 hidden sm:inline">/</span>
              <span className="font-bold text-slate-900 dark:text-white whitespace-nowrap shrink-0">
                {navItems.find((n) => n.id === activeTab)?.label}
              </span>
            </div>
          </div>

          <div className="flex items-center gap-2.5 shrink-0">
            <button
              type="button"
              onClick={() => setSheetsModalOpen(true)}
              className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 dark:border-[#1B3158] bg-white dark:bg-[#060E1F] hover:bg-slate-50 dark:hover:bg-[#13294E] px-3 py-2 text-xs font-semibold text-[#0B1F3A] dark:text-blue-300 transition-colors whitespace-nowrap shrink-0"
            >
              <FileSpreadsheet className="w-3.5 h-3.5 text-[#1D4ED8] dark:text-blue-400" />
              <span className="hidden sm:inline">{t.actions.syncGoogleSheets}</span>
              <span className="sm:hidden">Sheets</span>
            </button>

            <button
              type="button"
              onClick={() => {
                setEditingContribution(null);
                setPreselectedMember(null);
                setContributionModalOpen(true);
              }}
              className="inline-flex items-center gap-1.5 rounded-lg bg-[#0B1F3A] hover:bg-[#132f57] dark:bg-blue-700 dark:hover:bg-blue-600 px-4 py-2 text-xs font-semibold text-white transition-colors whitespace-nowrap shrink-0"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>{t.actions.recordPayment}</span>
            </button>
          </div>
        </header>

        <main className="flex-1 p-6 max-w-[1360px] w-full mx-auto">
          {activeTab === 'dashboard' && (
            <DashboardView
              members={members}
              contributions={contributions}
              centerSettings={centerSettings}
              loading={dataLoading}
              lang={lang}
              onOpenNewContribution={() => {
                setEditingContribution(null);
                setPreselectedMember(null);
                setContributionModalOpen(true);
              }}
              onOpenNewMember={() => {
                setEditingMember(null);
                setMemberModalOpen(true);
              }}
              onNavigateTab={(tab) => setActiveTab(tab)}
            />
          )}

          {activeTab === 'members' && (
            <MembersView
              members={members}
              contributions={contributions}
              centerSettings={centerSettings}
              loading={dataLoading}
              isAdmin={isAdmin}
              lang={lang}
              onAddMember={() => {
                setEditingMember(null);
                setMemberModalOpen(true);
              }}
              onEditMember={(member) => {
                setEditingMember(member);
                setMemberModalOpen(true);
              }}
              onDeleteMember={handleDeleteMember}
              onRecordForMember={(member) => {
                setEditingContribution(null);
                setPreselectedMember(member);
                setContributionModalOpen(true);
              }}
            />
          )}

          {activeTab === 'contributions' && (
            <ContributionsView
              contributions={contributions}
              centerSettings={centerSettings}
              loading={dataLoading}
              isAdmin={isAdmin}
              lang={lang}
              onAddContribution={() => {
                setEditingContribution(null);
                setPreselectedMember(null);
                setContributionModalOpen(true);
              }}
              onEditContribution={(c) => {
                setEditingContribution(c);
                setPreselectedMember(null);
                setContributionModalOpen(true);
              }}
              onQuickVerify={handleQuickVerifyContribution}
              onDeleteContribution={handleDeleteContribution}
            />
          )}

          {activeTab === 'reports' && (
            <ReportsView
              members={members}
              contributions={contributions}
              centerSettings={centerSettings}
              lang={lang}
              onOpenSheetsSync={() => setSheetsModalOpen(true)}
            />
          )}

          {activeTab === 'settings' && (
            <SettingsView
              centerSettings={centerSettings}
              admins={admins}
              isAdmin={isAdmin}
              isOwner={isOwner}
              currentUserEmail={(user.email || '').toLowerCase()}
              lang={lang}
              onSaveSettings={handleSaveSettings}
              onGrantAdmin={handleGrantAdmin}
              onRevokeAdmin={handleRevokeAdmin}
              onOpenSheetsSync={() => setSheetsModalOpen(true)}
            />
          )}
        </main>
      </div>

      {/* Offline Banner */}
      {!isOnline && (
        <div className="fixed bottom-4 left-4 z-50 flex items-center gap-2 rounded-lg bg-amber-600 px-3.5 py-2 text-xs font-semibold text-white shadow-lg">
          <WifiOff className="w-3.5 h-3.5" />
          <span>{t.labels.offlineBanner}</span>
        </div>
      )}

      {/* Modals */}
      <MemberModal
        isOpen={memberModalOpen}
        onClose={() => setMemberModalOpen(false)}
        onSave={handleSaveMember}
        editingMember={editingMember}
        suggestedCode={suggestedMemberCode}
        lang={lang}
      />

      <ContributionModal
        isOpen={contributionModalOpen}
        onClose={() => setContributionModalOpen(false)}
        onSave={handleSaveContribution}
        members={members}
        centerSettings={centerSettings}
        editingContribution={editingContribution}
        preselectedMember={preselectedMember}
        suggestedReceiptNo={suggestedReceiptNo}
        lang={lang}
      />

      <GoogleSheetsSyncModal
        isOpen={sheetsModalOpen}
        onClose={() => setSheetsModalOpen(false)}
        members={members}
        contributions={contributions}
        centerSettings={centerSettings}
        isAdmin={isAdmin}
        lang={lang}
        onSaveSheetSettings={handleSaveSheetSettings}
        onImportFromSheet={handleImportFromSheet}
      />
    </div>
  );
}

export default function App() {
  return (
    <ErrorBoundary>
      <AppContent />
    </ErrorBoundary>
  );
}
