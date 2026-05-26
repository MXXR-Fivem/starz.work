import type { Metadata } from "next";
import Link from "next/link";
import { FiLock, FiShield, FiTrash2, FiUserCheck } from "react-icons/fi";
import Navbar from "@/components/ui/navbar";

export const metadata: Metadata = {
    title: "Sécurité et confidentialité | Starz",
    description: "Informations de sécurité, confidentialité et gestion des données utilisées par Starz pour l'authentification OAuth."
};

const commitments = [
    {
        icon: FiUserCheck,
        title: "Données OAuth limitées",
        text: "Lors d'une connexion avec LinkedIn, Google ou GitHub, Starz utilise uniquement les informations nécessaires à l'identification du compte: identifiant fournisseur, nom, prénom et adresse email lorsque le fournisseur les transmet."
    },
    {
        icon: FiLock,
        title: "Usage strictement applicatif",
        text: "Ces données servent à créer ou connecter un compte Starz, sécuriser la session et permettre la liaison d'un fournisseur OAuth au profil utilisateur. Elles ne sont pas revendues."
    },
    {
        icon: FiShield,
        title: "Protection des accès",
        text: "Les sessions sont protégées par des jetons d'authentification, des cookies de rafraîchissement configurés côté serveur et des contrôles d'accès sur les routes privées."
    },
    {
        icon: FiTrash2,
        title: "Suppression possible",
        text: "Un utilisateur peut demander la suppression de son compte et des données associées. Les sessions, fournisseurs OAuth liés, favoris et candidatures sont supprimés avec le compte."
    }
];

export default function SecurityPage() {
    return (
        <main>
            <Navbar />

            <section className="mx-auto flex w-full max-w-6xl flex-col gap-10 px-4 pb-16 pt-8 sm:px-8 sm:pt-12">
                <div className="max-w-3xl">
                    <p className="w-fit rounded-full bg-thepurple/10 px-4 py-2 text-sm font-bold text-thepurple">
                        OAuth, sécurité et confidentialité
                    </p>
                    <h1 className="mt-5 text-3xl font-black leading-tight text-black/80 sm:text-5xl">
                        Protection des données utilisées pour se connecter à Starz
                    </h1>
                    <p className="mt-5 text-base leading-8 text-black/55 sm:text-lg">
                        Cette page explique comment Starz traite les données issues des connexions OAuth,
                        notamment LinkedIn, et comment les utilisateurs gardent le contrôle sur leur compte.
                    </p>
                </div>

                <div className="grid gap-4 md:grid-cols-2">
                    {commitments.map(({ icon: Icon, title, text }) => (
                        <article key={title} className="rounded-2xl border border-thepurple/10 bg-white p-6 shadow-ombre">
                            <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-xl bg-thepurple/10 text-thepurple">
                                <Icon className="h-5 w-5" />
                            </div>
                            <h2 className="text-xl font-black text-black/75">{title}</h2>
                            <p className="mt-3 text-sm leading-7 text-black/50">{text}</p>
                        </article>
                    ))}
                </div>

                <div className="grid gap-6 lg:grid-cols-[1fr_0.8fr]">
                    <section className="rounded-2xl border border-thepurple/10 bg-white p-6 shadow-ombre">
                        <h2 className="text-2xl font-black text-black/80">Détails du traitement</h2>
                        <div className="mt-5 space-y-5 text-sm leading-7 text-black/55">
                            <p>
                                Starz ne demande pas l&apos;accès aux messages privés, aux contacts étendus ou aux
                                publications LinkedIn. Les scopes OAuth utilisés pour LinkedIn sont limités à
                                l&apos;identité OpenID, au profil de base et à l&apos;email.
                            </p>
                            <p>
                                Les données de profil peuvent être utilisées pour préremplir le compte, éviter la
                                création de doublons et permettre à l&apos;utilisateur de retrouver son accès plus facilement.
                            </p>
                            <p>
                                Les données sont conservées tant que le compte existe ou tant qu&apos;elles sont nécessaires
                                au fonctionnement du service. La suppression du compte entraîne la suppression des
                                fournisseurs OAuth liés et des sessions associées.
                            </p>
                        </div>
                    </section>

                    <aside className="rounded-2xl border border-thepurple/10 bg-white p-6 shadow-ombre">
                        <h2 className="text-2xl font-black text-black/80">Contact</h2>
                        <p className="mt-4 text-sm leading-7 text-black/55">
                            Pour une demande liée à la sécurité, à la confidentialité ou à la suppression des données,
                            contactez l&apos;équipe Starz.
                        </p>
                        <a
                            href="mailto:contact@starz.work"
                            className="mt-5 inline-flex rounded-xl bg-thepurple px-5 py-3 text-sm font-bold text-white shadow-[0_4px_14px_rgba(111,45,189,0.25)] transition-transform hover:scale-[1.02]"
                        >
                            contact@starz.work
                        </a>
                        <Link
                            href="/auth/login"
                            className="mt-3 block w-fit rounded-xl border border-black/10 bg-white px-5 py-3 text-sm font-bold text-black/65 transition-colors hover:border-thepurple/30 hover:text-thepurple"
                        >
                            Gérer mon compte
                        </Link>
                    </aside>
                </div>
            </section>
        </main>
    );
}
