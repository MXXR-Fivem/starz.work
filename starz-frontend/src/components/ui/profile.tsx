/* eslint-disable @next/next/no-img-element */
"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { FiBell, FiCheck, FiEdit2, FiExternalLink, FiKey, FiLink, FiLogOut, FiMonitor, FiMoon, FiShield, FiSettings, FiSun, FiTrash2, FiUpload, FiUser, FiX } from "react-icons/fi";
import type { IconType } from "react-icons";
import { BsPerson } from "react-icons/bs";
import { IoArrowBack, IoCamera } from "react-icons/io5";
import { Logo } from "../assets/logo";
import { api, setAccessToken } from "@/lib/axios";
import { formatDateForFrenchInput, parseFrenchDateInput } from "@/lib/date";
import { decodeHtmlEntities } from "@/lib/html";
import { clearSessionCookie } from "@/lib/session";
import { persistTheme } from "@/lib/theme";
import { listSessions, oauthGetUrl, revokeAllSessions, revokeSession, type AccountSession, type OAuthProvider } from "@/features/auth/auth.api";

type UserProfile = {
    id: number;
    email: string | null;
    firstName: string;
    lastName: string;
    dateOfBirth: string | null;
    profilePhotoUrl: string | null;
    shortBio: string | null;
    linkedinUrl: string | null;
    githubUrl: string | null;
    portfolioUrl: string | null;
    workLocation: string | null;
    cvUrl: string | null;
    cvFilename: string | null;
    darkMode: boolean;
    skills: { id: number; name: string }[];
    linkedProviders: OAuthProvider[];
    hasPassword: boolean;
    role: string;
};

type DashboardData = {
    summary: {
        applicationsCount: number;
        viewedApplicationsCount: number;
        acceptedApplicationsCount: number;
        favoriteOffersCount: number;
        responseRate: number;
    };
    topSkills: { id: number; name: string; offersCount: number }[];
};

type NotificationEvent = "company_invite" | "application_update";

type NotificationItem = {
    id: number;
    event: NotificationEvent;
    eventData: Record<string, unknown>;
    seen: boolean;
    createdAt: string;
};

type CompanyInvitation = {
    id: number;
    companyId: number;
    companyName: string;
    status: string;
};

type EditableFieldProps = {
    label: string;
    value: string;
    type?: string;
    multiline?: boolean;
    onSave: (value: string) => Promise<void>;
};

type KeyEvent = { key: string; preventDefault: () => void };
type ChangeEvent = { target: HTMLInputElement | HTMLTextAreaElement };

type ConfirmModal = "logout" | "delete" | null;
type ProfileTabKey = "notifications" | "compte" | "profil" | "parametres";
type ProfileTab = { key: ProfileTabKey; icon: IconType; label: string };
type TabMessage = { tab: ProfileTabKey; text: string } | null;

const providers: OAuthProvider[] = ["google", "linkedin", "github"];
const profileTabs: ProfileTab[] = [
    { key: "notifications", icon: FiBell, label: "Notifications" },
    { key: "compte", icon: FiUser, label: "Compte" },
    { key: "profil", icon: BsPerson, label: "Profil public" },
    { key: "parametres", icon: FiSettings, label: "Paramètres" },
];

const emptyUser: UserProfile = {
    id: 0,
    email: null,
    firstName: "",
    lastName: "",
    dateOfBirth: null,
    profilePhotoUrl: null,
    shortBio: null,
    linkedinUrl: null,
    githubUrl: null,
    portfolioUrl: null,
    workLocation: null,
    cvUrl: null,
    cvFilename: null,
    darkMode: false,
    skills: [],
    linkedProviders: [],
    hasPassword: false,
    role: "user",
};

const formatDateTime = (value: string | null) => value ? new Date(value).toLocaleString("fr-FR", { dateStyle: "medium", timeStyle: "short" }) : "Jamais";
const eventText = (eventData: Record<string, unknown>, key: string) => {
    const value = eventData[key];
    return typeof value === "string" || typeof value === "number" ? String(value) : "";
};

const getDeviceLabel = (userAgent: string | null) => {
    const value = userAgent ?? "";
    const browser = value.includes("Firefox") ? "Firefox" : value.includes("Edg") ? "Edge" : value.includes("Chrome") ? "Chrome" : value.includes("Safari") ? "Safari" : "Navigateur inconnu";
    const os = value.includes("Windows") ? "Windows" : value.includes("Mac OS") ? "macOS" : value.includes("Android") ? "Android" : value.includes("iPhone") || value.includes("iPad") ? "iOS" : value.includes("Linux") ? "Linux" : "Appareil inconnu";
    return `${browser} sur ${os}`;
};

const getIpLabel = (ipAddress: string | null) => {
    if (!ipAddress) {
        return "IP inconnue";
    }

    if (ipAddress === "::1" || ipAddress === "127.0.0.1" || ipAddress === "::ffff:127.0.0.1") {
        return "Adresse locale";
    }

    return ipAddress;
};

function EditableField({ label, value, type = "text", multiline = false, onSave }: EditableFieldProps) {
    const [editing, setEditing] = useState(false);
    const [draft, setDraft] = useState(value);
    const [saving, setSaving] = useState(false);

    const save = async () => {
        setSaving(true);
        try {
            await onSave(draft);
            setEditing(false);
        } finally {
            setSaving(false);
        }
    };

    const handleKeyDown = (event: KeyEvent) => {
        if (event.key === "Enter" && !multiline) {
            event.preventDefault();
            save();
        }
    };

    return (
        <label className="flex flex-col gap-1.5">
            <span className="text-xs font-semibold text-black/45">{label}</span>
            <div className={`flex items-center gap-2 rounded-xl border px-4 py-2.5 ${editing ? "border-thepurple/40 bg-white" : "border-black/10 bg-black/[0.02]"}`}>
                {multiline ? (
                    <textarea
                        value={draft}
                        disabled={!editing || saving}
                        onChange={(event: ChangeEvent) => setDraft(event.target.value)}
                        rows={3}
                        className="w-full resize-none bg-transparent text-sm text-black/70 outline-none disabled:text-black/55"
                    />
                ) : (
                    <input
                        type={type}
                        value={draft}
                        disabled={!editing || saving}
                        onChange={(event: ChangeEvent) => setDraft(event.target.value)}
                        onKeyDown={handleKeyDown}
                        className="w-full bg-transparent text-sm text-black/70 outline-none disabled:text-black/55"
                    />
                )}
                <button
                    type="button"
                    onClick={() => editing ? save() : setEditing(true)}
                    className="shrink-0 text-black/35 hover:text-thepurple transition-colors"
                    aria-label={editing ? `Sauvegarder ${label}` : `Modifier ${label}`}
                >
                    <FiEdit2 className="h-4 w-4" />
                </button>
            </div>
        </label>
    );
}

export default function Profile() {
    const router = useRouter();
    const [activeTab, setActiveTab] = useState<ProfileTabKey>("compte");
    const [user, setUser] = useState<UserProfile>(emptyUser);
    const [data, setData] = useState<DashboardData | null>(null);
    const [skillsDraft, setSkillsDraft] = useState("");
    const [notifications, setNotifications] = useState<NotificationItem[]>([]);
    const [invitations, setInvitations] = useState<CompanyInvitation[]>([]);
    const [sessions, setSessions] = useState<AccountSession[]>([]);
    const [modal, setModal] = useState<ConfirmModal>(null);
    const [passwordModal, setPasswordModal] = useState(false);
    const [deleteCode, setDeleteCode] = useState("");
    const [passwordForm, setPasswordForm] = useState({ currentPassword: "", newPassword: "", confirmPassword: "", code: "" });
    const [message, setMessage] = useState<TabMessage>(null);
    const photoInputRef = useRef<HTMLInputElement | null>(null);
    const cvInputRef = useRef<HTMLInputElement | null>(null);

    const loadProfile = async () => {
        const [profileResponse, dataResponse] = await Promise.all([
            api.get("/me"),
            api.get("/me/data"),
        ]);
        setUser(profileResponse.data.data.user);
        setData(dataResponse.data.data);
    };

    const loadNotifications = async () => {
        const [notificationsResponse, invitationsResponse] = await Promise.all([
            api.get("/notifications", { params: { page: 0, size: 50 } }),
            api.get("/company/invitations").catch(() => ({ data: { data: { invitations: [] } } })),
        ]);
        setNotifications(notificationsResponse.data.data.items ?? []);
        setInvitations(invitationsResponse.data.data.invitations ?? []);
    };

    const loadSessions = async () => {
        setSessions(await listSessions());
    };

    useEffect(() => {
        const timer = window.setTimeout(() => {
            Promise.all([loadProfile(), loadNotifications(), loadSessions()]).catch(() => setMessage({ tab: "compte", text: "Impossible de charger le profil." }));
        }, 0);

        return () => window.clearTimeout(timer);
    }, []);

    const updateProfile = async (payload: Record<string, unknown>) => {
        const response = await api.patch("/me", payload);
        setUser(response.data.data.user);
        setMessage({ tab: activeTab, text: "Profil sauvegardé." });
    };

    const updateDarkMode = async () => {
        const nextDarkMode = !user.darkMode;
        persistTheme(nextDarkMode ? "dark" : "light");

        try {
            await updateProfile({ darkMode: nextDarkMode });
        } catch (error) {
            persistTheme(user.darkMode ? "dark" : "light");
            throw error;
        }
    };

    const uploadFile = async (kind: "profile-photo" | "cv", file: File) => {
        const response = await api.put(kind === "profile-photo" ? "/me/profile-photo" : "/me/cv", file, {
            headers: {
                "Content-Type": file.type,
                "x-filename": file.name,
            },
        });
        setUser(response.data.data.user);
    };

    const saveSkill = async () => {
        const skill = skillsDraft.trim();
        if (!skill) {
            return;
        }

        const skills = user.skills.map((currentSkill) => currentSkill.name);
        if (!skills.some((currentSkill) => currentSkill.toLowerCase() === skill.toLowerCase())) {
            await updateProfile({ skills: [...skills, skill] });
        }
        setSkillsDraft("");
    };

    const removeSkill = async (skillName: string) => {
        await updateProfile({ skills: user.skills.map((skill) => skill.name).filter((skill) => skill !== skillName) });
    };

    const handleSkillKeyDown = (event: KeyEvent) => {
        if (event.key === " " || event.key === "Enter") {
            event.preventDefault();
            saveSkill();
        }
    };

    const markNotificationSeen = async (notificationId: number) => {
        await api.patch("/notifications/seen", { ids: [notificationId] });
        setNotifications((currentNotifications) => currentNotifications.map((notification) => notification.id === notificationId ? { ...notification, seen: true } : notification));
    };

    const respondToInvitation = async (notification: NotificationItem, action: "accept" | "decline") => {
        const companyId = Number(notification.eventData.company_id);
        const invitation = invitations.find((currentInvitation) => currentInvitation.companyId === companyId && currentInvitation.status === "pending");

        if (!invitation) {
            setMessage({ tab: "notifications", text: "Invitation introuvable ou déjà traitée." });
            return;
        }

        await api.post(`/company/invitations/${invitation.id}/${action}`);
        await markNotificationSeen(notification.id);
        await Promise.all([loadNotifications(), loadProfile()]);
        setMessage({ tab: "notifications", text: action === "accept" ? "Invitation acceptée." : "Invitation refusée." });
    };

    const linkProvider = async (provider: OAuthProvider) => {
        const redirectUri = `${window.location.origin}/auth/callback/${provider}`;
        const state = JSON.stringify({
            provider,
            mode: "link",
            redirectTo: "/profile",
        });
        const url = await oauthGetUrl(provider, redirectUri, state);
        window.location.assign(url);
    };

    const logout = async () => {
        await api.post("/auth/logout").catch(() => undefined);
        setAccessToken(null);
        clearSessionCookie();
        router.push("/auth/login");
    };

    const revokeAccountSession = async (session: AccountSession) => {
        await revokeSession(session.id);

        if (session.isCurrentSession) {
            setAccessToken(null);
            clearSessionCookie();
            router.push("/auth/login");
            return;
        }

        await loadSessions();
        setMessage({ tab: "parametres", text: "Session révoquée." });
    };

    const revokeEverySession = async () => {
        await revokeAllSessions();
        setAccessToken(null);
        clearSessionCookie();
        router.push("/auth/login");
    };

    const requestDeleteCode = async () => {
        const response = await api.post("/me/delete-code");
        setMessage({ tab: "parametres", text: response.data.data?.code ? `Code de suppression : ${response.data.data.code}` : "Code envoyé par mail." });
    };

    const requestPasswordCode = async () => {
        const response = await api.post("/me/password-code");
        setPasswordModal(true);
        setMessage({ tab: "parametres", text: response.data.data?.code ? `Code mot de passe : ${response.data.data.code}` : "Code envoyé par mail." });
    };

    const updatePassword = async () => {
        if (passwordForm.newPassword !== passwordForm.confirmPassword) {
            setMessage({ tab: "parametres", text: "Les nouveaux mots de passe ne correspondent pas." });
            return;
        }

        await api.patch("/me/password", {
            currentPassword: passwordForm.currentPassword,
            newPassword: passwordForm.newPassword,
            code: passwordForm.code,
        });
        setAccessToken(null);
        clearSessionCookie();
        router.push("/auth/login");
    };

    const deleteAccount = async () => {
        await api.delete("/me", { data: { code: deleteCode } });
        setAccessToken(null);
        clearSessionCookie();
        router.push("/");
    };

    const avatarUrl = "https://ui-avatars.com/api/?background=6F2DBD&color=fff&name=" + encodeURIComponent(`${user.firstName} ${user.lastName}`.trim() || "Starz");
    const photoUrl = user.profilePhotoUrl || avatarUrl;
    const stats = data?.summary;
    const isDarkMode = user.darkMode;

    return (
        <div className="w-full px-4 pb-12 sm:px-8">
            <nav className="grid grid-cols-3 items-center px-0 py-4 mt-3 sm:px-8">
                <button onClick={() => router.back()} className="flex items-center" aria-label="Retour">
                    <IoArrowBack className="h-7 w-7 text-black/80 sm:h-9 sm:w-9 hover:scale-110 transition-transform" />
                </button>
                <div className="flex justify-center">
                    <Link href="/" aria-label="Accueil Starz"><Logo className="h-8 w-55.25 drop-shadow-[0px_3px_0.5px_rgba(0,0,0,0.3)] sm:h-12" /></Link>
                </div>
                <div />
            </nav>

            <div className="flex min-w-0 flex-col w-full mx-auto max-w-7xl lg:flex-row justify-center gap-4 mt-6 sm:mt-10">
                <aside className="bg-white rounded-2xl shadow-sm p-5 sm:p-7 w-full lg:w-[340px] xl:w-[400px] flex flex-col items-center gap-5">
                    <div className="relative">
                        <img src={photoUrl} alt="Photo de profil" className="w-28 h-28 rounded-full object-cover border-4 border-thepurple/15" />
                        <button onClick={() => photoInputRef.current?.click()} className="absolute bottom-0 right-0 flex h-9 w-9 items-center justify-center rounded-full bg-thepurple text-white shadow-ombre">
                            <IoCamera className="h-5 w-5" />
                        </button>
                        <input ref={photoInputRef} type="file" accept="image/png,image/jpeg,image/webp" className="hidden" onChange={(event) => event.target.files?.[0] && uploadFile("profile-photo", event.target.files[0])} />
                    </div>
                    <div className="text-center">
                        <h2 className="text-xl font-bold text-black/80">{user.firstName} {user.lastName}</h2>
                        <p className="text-sm text-black/40">{user.workLocation || "Localisation non renseignée"}</p>
                    </div>
                    <div className="grid w-full grid-cols-2 gap-3">
                        <div className="rounded-xl bg-thepurple/10 p-3 text-center"><div className="text-lg font-bold text-thepurple">{stats?.applicationsCount ?? 0}</div><div className="text-xs text-black/45">Candidatures</div></div>
                        <div className="rounded-xl bg-thepurple/10 p-3 text-center"><div className="text-lg font-bold text-thepurple">{stats?.favoriteOffersCount ?? 0}</div><div className="text-xs text-black/45">Offres suivies</div></div>
                        <div className="rounded-xl bg-black/5 p-3 text-center"><div className="text-lg font-bold text-black/70">{stats?.responseRate ?? 0}%</div><div className="text-xs text-black/45">Réponses</div></div>
                        <div className="rounded-xl bg-black/5 p-3 text-center"><div className="text-lg font-bold text-black/70">{stats?.acceptedApplicationsCount ?? 0}</div><div className="text-xs text-black/45">Acceptées</div></div>
                    </div>
                    {user.skills.length > 0 && <div className="flex w-full flex-wrap gap-2">{user.skills.slice(0, 6).map((skill) => <span key={skill.id} className="rounded-full bg-black/5 px-3 py-1 text-xs text-black/55">{skill.name}</span>)}</div>}
                </aside>

                <section className="bg-white rounded-2xl shadow-sm w-full min-w-0 lg:flex-1 flex flex-col sm:flex-row overflow-hidden">
                    <div className="flex max-w-full sm:flex-col sm:min-w-44 gap-1 border-b sm:border-b-0 sm:border-r border-black/5 p-3 sm:p-4 overflow-x-auto sm:overflow-x-visible scrollbar-hide">
                        {profileTabs.map(({ key, icon: Icon, label }) => (
                            <button key={key} onClick={() => setActiveTab(key)} className={`flex shrink-0 items-center gap-2 sm:gap-2.5 rounded-xl px-3 py-2 sm:py-2.5 text-sm font-medium whitespace-nowrap ${activeTab === key ? "bg-thepurple/10 text-thepurple" : "text-black/45 hover:bg-black/5"}`}>
                                <Icon className="h-4 w-4 shrink-0" />{label}
                            </button>
                        ))}
                        {user.role === "admin" && (
                            <Link href="/admin" className="mt-2 flex items-center gap-2.5 rounded-xl border border-thepurple/15 px-3 py-2.5 text-sm font-bold text-thepurple transition-colors hover:bg-thepurple/10">
                                <FiShield className="h-4 w-4" />Administration
                            </Link>
                        )}
                    </div>
                    <div className="min-w-0 flex-1 overflow-y-auto p-4 sm:p-7">
                        {message?.tab === activeTab && (
                            <div className="mb-4 flex items-center justify-between gap-3 rounded-xl bg-thepurple/10 px-4 py-2 text-sm text-thepurple">
                                <p>{message.text}</p>
                                <button type="button" onClick={() => setMessage(null)} className="rounded-full p-1 text-thepurple/70 hover:bg-thepurple/10 hover:text-thepurple" aria-label="Fermer le message">
                                    <FiX className="h-4 w-4" />
                                </button>
                            </div>
                        )}
                        {activeTab === "notifications" && <div className="flex flex-col gap-3">
                            <div>
                                <h1 className="text-xl font-bold text-black/80">Notifications</h1>
                                <p className="text-sm text-black/40">Invitations et mises à jour importantes.</p>
                            </div>
                            {notifications.length === 0 && <div className="rounded-xl border border-black/10 p-5 text-sm text-black/45">Aucune notification pour le moment.</div>}
                            {notifications.map((notification) => {
                                const companyName = eventText(notification.eventData, "company_name");
                                const offerTitle = eventText(notification.eventData, "offer_title");
                                const offerId = eventText(notification.eventData, "offer_id");

                                return (
                                    <div key={notification.id} className={`rounded-xl border p-4 ${notification.seen ? "border-black/10 bg-black/2" : "border-thepurple/20 bg-thepurple/[0.04]"}`}>
                                        <div className="flex items-start justify-between gap-4">
                                            <div>
                                                <p className="text-sm font-semibold text-black/75">{notification.event === "company_invite" ? "Invitation entreprise" : "Candidature mise à jour"}</p>
                                                <p className="mt-1 text-sm text-black/50">
                                                    {notification.event === "company_invite"
                                                        ? `${companyName || "Une entreprise"} vous invite à rejoindre son espace.`
                                                        : `${companyName || "Une entreprise"} a mis à jour votre candidature${offerTitle ? ` pour ${decodeHtmlEntities(offerTitle)}` : ""}.`}
                                                </p>
                                                <p className="mt-2 text-xs text-black/30">{new Date(notification.createdAt).toLocaleDateString("fr-FR")}</p>
                                            </div>
                                            {!notification.seen && <span className="rounded-full bg-thepurple px-2.5 py-1 text-xs font-semibold text-white">Nouveau</span>}
                                        </div>
                                        <div className="mt-4 flex flex-wrap gap-2">
                                            {notification.event === "company_invite" ? (
                                                <>
                                                    <button onClick={() => respondToInvitation(notification, "accept")} disabled={notification.seen} className="flex items-center gap-2 rounded-xl bg-thepurple px-4 py-2 text-sm font-semibold text-white disabled:bg-black/10 disabled:text-black/35"><FiCheck />Accepter</button>
                                                    <button onClick={() => respondToInvitation(notification, "decline")} disabled={notification.seen} className="flex items-center gap-2 rounded-xl border border-black/10 px-4 py-2 text-sm font-semibold text-black/55 disabled:text-black/25"><FiX />Refuser</button>
                                                </>
                                            ) : (
                                                <>
                                                    {offerId && <Link href={`/offers/${offerId}`} className="flex items-center gap-2 rounded-xl bg-thepurple px-4 py-2 text-sm font-semibold text-white"><FiExternalLink />Voir l&apos;offre</Link>}
                                                    {!notification.seen && <button onClick={() => markNotificationSeen(notification.id)} className="rounded-xl border border-black/10 px-4 py-2 text-sm font-semibold text-black/55">Marquer comme lu</button>}
                                                </>
                                            )}
                                        </div>
                                    </div>
                                );
                            })}
                        </div>}
                        {activeTab === "compte" && <div className="grid grid-cols-2 gap-4">
                            <EditableField key={`firstName-${user.firstName}`} label="Prénom" value={user.firstName} onSave={(value) => updateProfile({ firstName: value })} />
                            <EditableField key={`lastName-${user.lastName}`} label="Nom" value={user.lastName} onSave={(value) => updateProfile({ lastName: value })} />
                            <EditableField
                                key={`date-${user.dateOfBirth}`}
                                label="Date de naissance"
                                value={formatDateForFrenchInput(user.dateOfBirth)}
                                onSave={(value) => {
                                    const dateOfBirth = parseFrenchDateInput(value);

                                    if (dateOfBirth === null) {
                                        setMessage({ tab: "compte", text: "La date de naissance doit être au format jj/mm/aaaa." });
                                        return Promise.resolve();
                                    }

                                    return updateProfile({ dateOfBirth: dateOfBirth || null });
                                }}
                            />
                            <EditableField key={`work-${user.workLocation}`} label="Zone de travail" value={user.workLocation ?? ""} onSave={(value) => updateProfile({ workLocation: value || null })} />
                            <div className="col-span-2 rounded-xl border border-black/10 p-4 text-sm text-black/55">Email : {user.email}</div>
                            <button onClick={() => cvInputRef.current?.click()} className="col-span-2 flex items-center justify-between rounded-xl border border-black/10 px-4 py-3 text-sm text-black/60 hover:border-thepurple/30"><span>{user.cvFilename || "Ajouter un CV"}</span><FiUpload /></button>
                            <input ref={cvInputRef} type="file" accept=".pdf,.doc,.docx" className="hidden" onChange={(event) => event.target.files?.[0] && uploadFile("cv", event.target.files[0])} />
                            <div className="col-span-2 flex flex-col sm:flex-row gap-2 ">{providers.map((provider) => <button key={provider} disabled={user.linkedProviders.includes(provider)} onClick={() => linkProvider(provider)} className="flex items-center justify-center gap-2 rounded-xl border border-black/10 px-4 py-2 text-sm capitalize text-black/60 disabled:bg-black/5 disabled:text-black/30 sm:flex-none flex-1 hover:bg-black/2"><FiLink />{user.linkedProviders.includes(provider) ? `${provider} lié` : `Lier ${provider}`}</button>)}</div>
                        </div>}
                        {activeTab === "profil" && <div className="flex flex-col gap-4">
                            <EditableField key={`bio-${user.shortBio}`} label="Présentation brève" value={user.shortBio ?? ""} multiline onSave={(value) => updateProfile({ shortBio: value || null })} />
                            <EditableField key={`linkedin-${user.linkedinUrl}`} label="LinkedIn" value={user.linkedinUrl ?? ""} onSave={(value) => updateProfile({ linkedinUrl: value || null })} />
                            <EditableField key={`github-${user.githubUrl}`} label="GitHub" value={user.githubUrl ?? ""} onSave={(value) => updateProfile({ githubUrl: value || null })} />
                            <EditableField key={`portfolio-${user.portfolioUrl}`} label="Portfolio" value={user.portfolioUrl ?? ""} onSave={(value) => updateProfile({ portfolioUrl: value || null })} />
                            <div>   
                                <p className="mb-2 text-xs font-semibold text-black/45">Skills</p>
                                <div className="mb-3 flex flex-wrap gap-2">
                                    {user.skills.map((skill) => (
                                        <span key={skill.id} className="inline-flex items-center gap-1.5 rounded-full bg-thepurple/10 px-3 py-1 text-sm font-medium text-thepurple">
                                            {skill.name}
                                            <button type="button" onClick={() => removeSkill(skill.name)} className="rounded-full p-0.5 text-thepurple/70 hover:bg-thepurple/10 hover:text-thepurple" aria-label={`Supprimer ${skill.name}`}>
                                                <FiX className="h-3.5 w-3.5" />
                                            </button>
                                        </span>
                                    ))}
                                </div>
                                <input value={skillsDraft} onChange={(event) => setSkillsDraft(event.target.value)} onKeyDown={handleSkillKeyDown} placeholder="Tape un skill puis espace" className="w-full rounded-xl border border-black/10 px-4 py-2 text-sm outline-none focus:border-thepurple/40" />
                            </div>
                        </div>}
                        {activeTab === "parametres" && <div className="flex flex-col gap-4">
                            <div className="flex items-center justify-between gap-4 rounded-xl border border-black/10 px-4 py-3">
                                <div className="flex min-w-0 items-center gap-3">
                                    <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-thepurple/10 text-thepurple">
                                        {isDarkMode ? <FiMoon /> : <FiSun />}
                                    </div>
                                    <div className="min-w-0">
                                        <h1 className="text-sm font-bold text-black/80">Mode sombre</h1>
                                        <p className="text-xs text-black/40">Adapter l&apos;apparence de l&apos;application.</p>
                                    </div>
                                </div>
                                <button
                                    type="button"
                                    role="switch"
                                    aria-checked={isDarkMode}
                                    onClick={updateDarkMode}
                                    className={`flex h-7 w-12 shrink-0 items-center rounded-full p-1 transition-colors ${isDarkMode ? "bg-thepurple" : "bg-black/15"}`}
                                >
                                    <span className={`h-5 w-5 rounded-full bg-white shadow-sm transition-transform ${isDarkMode ? "translate-x-5" : "translate-x-0"}`} />
                                </button>
                            </div>
                            <div>
                                <div className="mb-3 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between sm:gap-4">
                                    <div>
                                        <h1 className="text-xl font-bold text-black/80">Sessions actives</h1>
                                        <p className="text-sm text-black/40">Appareils connectés à ce compte.</p>
                                    </div>
                                    <button onClick={revokeEverySession} disabled={sessions.length === 0} className="w-full rounded-xl bg-thepurple px-4 py-2 text-sm font-semibold text-white transition-all duration-150 hover:bg-thepurple/90 hover:scale-[1.02] disabled:bg-black/10 disabled:text-black/35 disabled:hover:scale-100 sm:w-auto">
                                        Tout révoquer
                                    </button>
                                </div>
                                <div className="flex flex-col gap-2">
                                    {sessions.length === 0 && <div className="rounded-xl border border-black/10 p-4 text-sm text-black/45">Aucune session active.</div>}
                                    {sessions.map((session) => (
                                        <div key={session.id} className="flex flex-col gap-4 rounded-xl border border-black/10 px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
                                            <div className="flex min-w-0 items-start gap-3">
                                                <div className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-thepurple/10 text-thepurple"><FiMonitor /></div>
                                                <div className="min-w-0">
                                                    <div className="flex flex-wrap items-center gap-2">
                                                        <p className="text-sm font-semibold text-black/70">{getDeviceLabel(session.userAgent)}</p>
                                                        {session.isCurrentSession && <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-xs font-semibold text-emerald-700">Session actuelle</span>}
                                                    </div>
                                                    <p className="break-words text-xs text-black/40 sm:truncate">{getIpLabel(session.ipAddress)} · Dernière activité : {formatDateTime(session.lastSeenAt)}</p>
                                                    <p className="text-xs text-black/30">Créée le {formatDateTime(session.createdAt)} · Expire le {formatDateTime(session.expiresAt)}</p>
                                                </div>
                                            </div>
                                            <button onClick={() => revokeAccountSession(session)} className="w-full shrink-0 rounded-xl border border-red-200 px-3 py-2 text-sm font-semibold text-red-500 hover:bg-red-50 sm:w-auto">
                                                Révoquer
                                            </button>
                                        </div>
                                    ))}
                                </div>
                            </div>
                            {user.hasPassword && <button onClick={requestPasswordCode} className="flex items-center justify-between rounded-xl border border-black/10 px-4 py-3 text-sm font-semibold text-black/60"><span>Modifier le mot de passe</span><FiKey /></button>}
                            <button onClick={() => setModal("logout")} className="flex items-center justify-between rounded-xl border border-black/10 px-4 py-3 text-sm font-semibold text-black/60"><span>Se déconnecter</span><FiLogOut /></button>
                            <button onClick={() => { setModal("delete"); requestDeleteCode(); }} className="flex items-center justify-between rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-semibold text-red-500"><span>Supprimer le compte</span><FiTrash2 /></button>
                        </div>}
                    </div>
                </section>
            </div>

            {modal && <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4"><div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-ombre"><h2 className="mb-2 text-lg font-bold text-black/80">Confirmer</h2><p className="mb-4 text-sm text-black/50">{modal === "logout" ? "Voulez-vous vraiment vous déconnecter ?" : "Entrez le code reçu par mail pour supprimer définitivement votre compte."}</p>{modal === "delete" && <input value={deleteCode} onChange={(event) => setDeleteCode(event.target.value)} type="text" name="delete-account-code" autoComplete="one-time-code" autoCorrect="off" spellCheck={false} inputMode="numeric" maxLength={6} placeholder="Code à 6 chiffres" className="mb-4 w-full rounded-xl border border-black/10 px-4 py-2 text-sm outline-none focus:border-red-300" />}<div className="flex gap-2"><button onClick={() => setModal(null)} className="flex-1 rounded-xl border border-black/10 px-4 py-2 text-sm font-semibold text-black/50 hover:bg-black/5">Annuler</button><button onClick={modal === "logout" ? logout : deleteAccount} className="flex-1 rounded-xl bg-thepurple px-4 py-2 text-sm font-semibold text-white hover:bg-thepurple/80">Confirmer</button></div></div></div>}
            {passwordModal && <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4"><div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-ombre"><h2 className="mb-2 text-lg font-bold text-black/80">Modifier le mot de passe</h2><p className="mb-4 text-sm text-black/50">Entre ton mot de passe actuel, le nouveau mot de passe et le code reçu par mail.</p><div className="mb-4 flex flex-col gap-3"><input type="password" value={passwordForm.currentPassword} onChange={(event) => setPasswordForm((form) => ({ ...form, currentPassword: event.target.value }))} placeholder="Mot de passe actuel" className="w-full rounded-xl border border-black/10 px-4 py-2 text-sm outline-none focus:border-thepurple/40" /><input type="password" value={passwordForm.newPassword} onChange={(event) => setPasswordForm((form) => ({ ...form, newPassword: event.target.value }))} placeholder="Nouveau mot de passe" className="w-full rounded-xl border border-black/10 px-4 py-2 text-sm outline-none focus:border-thepurple/40" /><input type="password" value={passwordForm.confirmPassword} onChange={(event) => setPasswordForm((form) => ({ ...form, confirmPassword: event.target.value }))} placeholder="Confirmer le nouveau mot de passe" className="w-full rounded-xl border border-black/10 px-4 py-2 text-sm outline-none focus:border-thepurple/40" /><input value={passwordForm.code} onChange={(event) => setPasswordForm((form) => ({ ...form, code: event.target.value }))} type="text" name="password-update-code" autoComplete="one-time-code" autoCorrect="off" spellCheck={false} inputMode="numeric" maxLength={6} placeholder="Code à 6 chiffres" className="w-full rounded-xl border border-black/10 px-4 py-2 text-sm outline-none focus:border-thepurple/40" /></div><div className="flex gap-2"><button onClick={() => setPasswordModal(false)} className="flex-1 rounded-xl border border-black/10 px-4 py-2 text-sm font-semibold text-black/50">Annuler</button><button onClick={updatePassword} className="flex-1 rounded-xl bg-thepurple px-4 py-2 text-sm font-semibold text-white">Confirmer</button></div></div></div>}
        </div>
    );
}
