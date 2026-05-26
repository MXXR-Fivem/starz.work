"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { api } from "@/lib/axios";
import { decodeHtmlEntities } from "@/lib/html";
import Navbar from "@/components/ui/navbar";
import { iOffers } from "@/components/schemas/offerapi";
import { formatContractType, formatRemotePolicy, formatSalary } from "@/lib/offerLabels";
import { IoArrowBack } from "react-icons/io5";
import { FaHeart, FaRegHeart } from "react-icons/fa";
import { useRouter } from "next/navigation";

const AI_API_URL = process.env.NEXT_PUBLIC_AI_API_URL ?? "http://localhost:8080";
const MAX_DISPLAYED_KEYWORDS = 25;

const formatOfferDate = (value?: string | null): string | null => {
    if (!value) {
        return null;
    }

    const date = new Date(value);
    if (Number.isNaN(date.getTime())) {
        return null;
    }

    return date.toLocaleDateString("fr-FR", {
        day: "numeric",
        month: "long",
        year: "numeric",
    });
};

type AtsResult = {
    score: number;
    match_level?: "strong_match" | "partial_match" | "weak_match";
    keywords_offre?: string[];
    keywords_trouves: string[];
    keywords_manquants: string[];
    suggestions?: string[];
};

type ApplicationListItem = {
    offer: {
        id: number;
    };
};

type UploadedCvUser = {
    cvUrl: string | null;
};

type FavoriteListItem = {
    offer: {
        id: number;
    };
};

const buildOfferTextForAnalysis = (offer: iOffers): string => {
    const skills = offer.skills.map((skill) => skill.name).join(", ");

    return [
        offer.title,
        offer.companyName,
        offer.description,
        offer.descriptionPreview,
        skills ? `Skills: ${skills}` : "",
    ].filter(Boolean).join("\n\n");
};

const matchLevelLabel = (level?: AtsResult["match_level"]) => {
    if (level === "strong_match") {
        return "Très compatible";
    }

    if (level === "partial_match") {
        return "Compatibilité partielle";
    }

    return "Compatibilité faible";
};

export default function OfferDetail() {
    const router  = useRouter();
    const { id } = useParams();
    const offerId = Number(Array.isArray(id) ? id[0] : id);

    const [offer, setOffer] = useState<iOffers | null>(null);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [hasApplied, setHasApplied] = useState(false);
    const [isApplying, setIsApplying] = useState(false);
    const [applicationError, setApplicationError] = useState<string | null>(null);
    const [isConfirmationOpen, setIsConfirmationOpen] = useState(false);
    const [isFavorite, setIsFavorite] = useState(false);
    const [isFavoriteLoading, setIsFavoriteLoading] = useState(false);
    const [favoriteError, setFavoriteError] = useState<string | null>(null);

    const [isScannerOpen, setIsScannerOpen] = useState(false);
    const [cvText, setCvText] = useState("");
    const [cvFile, setCvFile] = useState<File | null>(null);
    const [isAnalyzing, setIsAnalyzing] = useState(false);
    const [analysisResult, setAnalysisResult] = useState<AtsResult | null>(null);
    const [analysisError, setAnalysisError] = useState<string | null>(null);
    const contractType = formatContractType(offer?.contractType);
    const remotePolicy = formatRemotePolicy(offer?.remotePolicy);
    const salary = offer ? formatSalary(offer) : null;
    const offerDate = offer ? formatOfferDate(offer.sourcePostedAt ?? offer.publishedAt ?? offer.createdAt) : null;

    useEffect(() => {
        const loadOffer = async () => {
            try {
                const response = await api.get(`/offers/${offerId}`);
                const offerData = response.data.data.offer;

                if (!offerData.skills) {
                    offerData.skills = [];
                }

                setOffer(offerData);

                const applicationsResponse = await api.get("/applications", {
                    params: { page: 0, size: 100 }
                }).catch(() => null);
                const applications = applicationsResponse?.data.data.items as ApplicationListItem[] | undefined;

                setHasApplied(Boolean(applications?.some((application) => application.offer.id === offerData.id)));

                const favoritesResponse = await api.get("/me/favorites", {
                    params: { page: 0, size: 100 }
                }).catch(() => null);
                const favorites = favoritesResponse?.data.data.items as FavoriteListItem[] | undefined;

                setIsFavorite(Boolean(favorites?.some((favorite) => favorite.offer.id === offerData.id)));
            } catch (err) {
                setError("Impossible de charger cette offre.");
                console.error(err);
            } finally {
                setIsLoading(false);
            }
        };

        if (offerId) {
            loadOffer();
        }
    }, [offerId]);

    const toggleFavorite = async () => {
        if (!offer || isFavoriteLoading) {
            return;
        }

        setIsFavoriteLoading(true);
        setFavoriteError(null);

        try {
            if (isFavorite) {
                await api.delete(`/me/favorites/${offer.id}`);
                setIsFavorite(false);
                return;
            }

            await api.post("/me/favorites", { offerId: offer.id });
            setIsFavorite(true);
        } catch (err) {
            const status = (err as { response?: { status?: number } }).response?.status;
            setFavoriteError(status === 401
                ? "Connecte-toi pour ajouter cette offre à tes favoris."
                : "Impossible de modifier ce favori.");
        } finally {
            setIsFavoriteLoading(false);
        }
    };

    const getCvUploadContentType = (file: File): string | null => {
        const extension = file.name.split(".").pop()?.toLowerCase();

        if (file.type === "application/pdf" || extension === "pdf") {
            return "application/pdf";
        }

        if (file.type === "application/msword" || extension === "doc") {
            return "application/msword";
        }

        if (
            file.type === "application/vnd.openxmlformats-officedocument.wordprocessingml.document" ||
            extension === "docx"
        ) {
            return "application/vnd.openxmlformats-officedocument.wordprocessingml.document";
        }

        return null;
    };

    const uploadSelectedCv = async (file: File): Promise<string> => {
        const contentType = getCvUploadContentType(file);

        if (!contentType) {
            throw new Error("unsupported_cv_file");
        }

        const response = await api.put("/me/cv", file, {
            headers: {
                "Content-Type": contentType,
                "x-filename": file.name,
            },
        });
        const user = response.data.data.user as UploadedCvUser;

        if (!user.cvUrl) {
            throw new Error("missing_cv_url");
        }

        return user.cvUrl;
    };

    const handleApply = async () => {
        if (!offer || hasApplied || isApplying) {
            return;
        }

        setIsApplying(true);
        setApplicationError(null);

        try {
            const resumeUrl = cvFile ? await uploadSelectedCv(cvFile) : undefined;

            await api.post("/applications", {
                offerId: offer.id,
                ...(resumeUrl ? { resumeUrl } : {}),
            });
            setHasApplied(true);
            setIsScannerOpen(false);
            setIsConfirmationOpen(true);
        } catch (err) {
            if (err instanceof Error && err.message === "unsupported_cv_file") {
                setApplicationError("Le CV déposé doit être au format PDF, DOC ou DOCX pour candidater.");
                return;
            }

            const status = (err as { response?: { status?: number } }).response?.status;

            if (status === 409) {
                setHasApplied(true);
                setIsScannerOpen(false);
                setIsConfirmationOpen(true);
                return;
            }

            setApplicationError(status === 401
                ? "Connecte-toi pour candidater à cette offre."
                : "Impossible d'envoyer la candidature. Réessaie.");
        } finally {
            setIsApplying(false);
        }
    };

    const setSelectedCvFile = (file: File) => {
        setAnalysisError(null);
        setCvFile(file);

        if (file.type === "application/pdf" || file.name.toLowerCase().endsWith(".pdf")) {
            setCvText("");
            return;
        }

        const reader = new FileReader();
        reader.onload = (event) => {
            setCvText(event.target?.result as string);
        };
        reader.readAsText(file);
    };

    const handleDrop = (event: React.DragEvent<HTMLDivElement>) => {
        event.preventDefault();

        const file = event.dataTransfer.files[0];
        if (!file) return;

        setSelectedCvFile(file);
    };

    const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
        const file = event.target.files?.[0];
        if (!file) return;

        setSelectedCvFile(file);
    };

    const handleAnalyze = async () => {
        if (!cvFile && !cvText.trim()) {
            setAnalysisError("Veuillez coller ou déposer votre CV.");
            return;
        }

        setIsAnalyzing(true);
        setAnalysisError(null);
        setAnalysisResult(null);

        try {
            const formData = new FormData();
            formData.append("offer", offer ? buildOfferTextForAnalysis(offer) : "");
            formData.append("cv", cvText);

            if (cvFile) {
                formData.append("file", cvFile);
            }

            const response = await fetch(`${AI_API_URL}/analyze`, {
                method: "POST",
                body: formData,
            });

            if (!response.ok) {
                throw new Error("Analyze request failed");
            }

            setAnalysisResult(await response.json());
        } catch (err) {
            setAnalysisError("Erreur lors de l'analyse. Réessayez.");
            console.error(err);
        } finally {
            setIsAnalyzing(false);
        }
    };

    if (isLoading) {
        return (
            <main>
                <Navbar />
                <div className="flex justify-center mt-20 text-black/40 text-sm">
                    Chargement de l&apos;offre…
                </div>
            </main>
        );
    }

    if (error || !offer) {
        return (
            <main>
                <Navbar />
                <div className="flex justify-center mt-20 text-red-400 text-sm">
                    {error || "Offre introuvable."}
                </div>
            </main>
        );
    }

    return (
        <main>
            <Navbar />
            <div className="flex justify-center mt-8 px-4">
                <div className="w-full max-w-3xl flex flex-col gap-3 mb-10">
                    <div className="border border-thepurple/10 rounded-2xl bg-white shadow-ombre px-6 py-5 flex flex-col gap-4">
                        <div className="flex items-center justify-between">
                            <button onClick={() => router.back()} aria-label="Retour">
                                <IoArrowBack className="h-6 w-6 text-black/80 hover:scale-110"/>
                            </button>
                            <button
                                onClick={toggleFavorite}
                                disabled={isFavoriteLoading}
                                aria-label={isFavorite ? "Retirer des favoris" : "Ajouter aux favoris"}
                                className={`rounded-full p-2 transition-colors disabled:opacity-50 ${isFavorite ? "text-rose-500 hover:bg-rose-50" : "text-black/35 hover:bg-black/5 hover:text-rose-400"}`}
                            >
                                {isFavorite ? <FaHeart className="h-5 w-5" /> : <FaRegHeart className="h-5 w-5" />}
                            </button>
                        </div>
                        <div>
                            <p className="text-sm text-black/50 font-medium">{offer.companyName}</p>
                            <h1 className="text-xl font-bold text-black/85 mt-0.5">{decodeHtmlEntities(offer.title)}</h1>
                        </div>
                        {favoriteError && (
                            <p className="text-xs text-red-400">{favoriteError}</p>
                        )}

                        <div className="flex flex-wrap gap-2">
                            {offer.location && (
                                <span className="px-2 py-0.5 rounded-full bg-black/5 text-black/55 text-xs">
                                    {offer.location}
                                </span>
                            )}
                            {contractType && (
                                <span className="px-2 py-0.5 rounded-full bg-thepurple/10 text-thepurple text-xs font-medium">
                                    {contractType}
                                </span>
                            )}
                            {remotePolicy && (
                                <span className="px-2 py-0.5 rounded-full bg-thepurple/10 text-thepurple text-xs font-medium">
                                    {remotePolicy}
                                </span>
                            )}
                            {offerDate && (
                                <span className="px-2 py-0.5 rounded-full bg-black/5 text-black/55 text-xs">
                                    Publiée le {offerDate}
                                </span>
                            )}
                        </div>

                        {salary && <p className="text-sm text-black/55 font-medium">{salary}</p>}

                        {offer.skills.length > 0 && (
                            <div className="flex flex-wrap gap-1.5">
                                {offer.skills.map((skill) => (
                                    <span key={skill.id} className="px-2 py-0.5 rounded-md bg-black/5 text-black/60 text-xs">
                                        {skill.name}
                                    </span>
                                ))}
                            </div>
                        )}

                        {(offer.description || offer.descriptionPreview) && (
                            <p className="text-sm text-black/65 leading-relaxed whitespace-pre-line">
                                {offer.description || offer.descriptionPreview}
                            </p>
                        )}
                    </div>

                    <div className="flex flex-col gap-3 sm:flex-row">
                        <button
                            onClick={() => {
                                if (hasApplied) return;
                                setIsScannerOpen(true);
                                setAnalysisResult(null);
                                setCvText("");
                                setCvFile(null);
                                setApplicationError(null);
                            }}
                            disabled={hasApplied}
                            className={`flex-1 py-3 rounded-2xl font-semibold text-sm shadow-ombre transition-opacity ${hasApplied ? "bg-black/10 text-black/40 cursor-not-allowed" : "bg-thepurple text-white hover:opacity-90"}`}
                        >
                            {hasApplied ? "Envoyé" : "Candidater"}
                        </button>
                        {hasApplied && (
                            <Link
                                href="/applications"
                                className="flex-1 py-3 rounded-2xl bg-thepurple text-center text-white font-semibold text-sm shadow-ombre hover:opacity-90 transition-opacity"
                            >
                                Suivre la démarche
                            </Link>
                        )}
                    </div>
                </div>
            </div>

            {isScannerOpen && (
                <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 px-4" onClick={() => setIsScannerOpen(false)}>
                    <div className="bg-white rounded-2xl shadow-ombre w-full max-w-lg p-6 flex flex-col gap-4" onClick={(e) => e.stopPropagation()}>
                        <div className="flex items-center justify-between">
                            <div>
                                <h2 className="font-bold text-black/85 text-lg">Candidater à cette offre</h2>
                                <p className="text-xs text-black/50 mt-1">Scanner votre CV pour cette offre ou postuler plus tard.</p>
                            </div>
                            <button
                                onClick={() => setIsScannerOpen(false)}
                                className="text-black/40 hover:text-black/70 text-xl font-bold"
                            >
                                
                            </button>
                        </div>

                        <p className="text-xs text-black/50">
                            Si un CV est déjà enregistré dans votre profil, il pourra être utilisé automatiquement. Vous pouvez aussi téléverser un CV spécifique à cette offre ci-dessous.
                        </p>

                        <div className="border-2 border-dashed border-thepurple/30 rounded-xl p-4 text-center text-sm text-black/40 hover:border-thepurple/60 transition-colors">
                            <div
                                onDrop={handleDrop}
                                onDragOver={(event) => event.preventDefault()}
                                className="cursor-pointer"
                            >
                                Glissez-déposez un fichier .pdf, .doc, .docx ou .txt ici
                                <div className="mt-2">
                                    <label className="cursor-pointer text-thepurple underline text-xs">
                                        ou choisir un fichier
                                        <input
                                            type="file"
                                            accept=".pdf,.doc,.docx,.txt"
                                            onChange={handleFileChange}
                                            className="hidden"
                                        />
                                    </label>
                                </div>
                            </div>
                        </div>

                        {cvFile && (
                            <p className="text-xs text-black/50">
                                Fichier sélectionné : {cvFile.name}
                            </p>
                        )}

                        <textarea
                            value={cvText}
                            onChange={(event) => {
                                setCvText(event.target.value);
                                setCvFile(null);
                            }}
                            placeholder="Ou collez le texte de votre CV ici…"
                            rows={6}
                            className="w-full border border-black/10 rounded-xl px-3 py-2 text-sm text-black/70 resize-none focus:outline-none focus:border-thepurple/50"
                        />

                        {analysisError && (
                            <p className="text-red-400 text-xs">{analysisError}</p>
                        )}
                        {applicationError && (
                            <p className="text-red-400 text-xs">{applicationError}</p>
                        )}

                        <button
                            onClick={handleAnalyze}
                            disabled={isAnalyzing}
                            className="w-full py-2.5 rounded-xl bg-thepurple text-white font-semibold text-sm shadow-ombre hover:opacity-90 transition-opacity disabled:opacity-50"
                        >
                            {isAnalyzing ? "Analyse en cours…" : "Scanner (ATS)"}
                        </button>

                        <button
                            type="button"
                            onClick={handleApply}
                            disabled={hasApplied || isApplying}
                            className="w-full py-2.5 rounded-xl bg-thepurple text-white font-semibold text-sm shadow-ombre hover:opacity-90 transition-opacity disabled:bg-black/10 disabled:text-black/40 disabled:opacity-100 disabled:cursor-not-allowed"
                        >
                            {hasApplied ? "Envoyé" : isApplying ? "Envoi…" : "Candidater"}
                        </button>

                        <button
                            type="button"
                            onClick={() => setIsScannerOpen(false)}
                            className="w-full py-2.5 rounded-xl border border-black/10 text-black text-sm hover:bg-black/5 transition-colors"
                        >
                            Annuler
                        </button>

                        {analysisResult && (
                            <div className="flex flex-col gap-3 border-t border-black/10 pt-4">
                                <div className="flex items-center gap-3">
                                    <span className="text-sm font-medium text-black/60">Score ATS :</span>
                                    <span className={`text-2xl font-bold ${analysisResult.score >= 60 ? "text-green-500" : analysisResult.score >= 30 ? "text-yellow-500" : "text-red-400"}`}>
                                        {analysisResult.score}%
                                    </span>
                                    <span className="rounded-full bg-black/5 px-2.5 py-1 text-xs font-semibold text-black/50">
                                        {matchLevelLabel(analysisResult.match_level)}
                                    </span>
                                </div>

                                {analysisResult.keywords_offre && analysisResult.keywords_offre.length > 0 && (
                                    <div>
                                        <p className="text-xs font-semibold text-black/50 mb-1.5">Compétences détectées dans l&apos;offre</p>
                                        <div className="flex flex-wrap gap-1.5">
                                            {analysisResult.keywords_offre.slice(0, MAX_DISPLAYED_KEYWORDS).map((keyword) => (
                                                <span key={keyword} className="px-2 py-0.5 rounded-md bg-black/5 text-black/55 text-xs border border-black/10">
                                                    {keyword}
                                                </span>
                                            ))}
                                        </div>
                                    </div>
                                )}

                                {analysisResult.keywords_trouves.length > 0 && (
                                    <div>
                                        <p className="text-xs font-semibold text-black/50 mb-1.5">Mots trouvés ✓</p>
                                        <div className="flex flex-wrap gap-1.5">
                                            {analysisResult.keywords_trouves.slice(0, MAX_DISPLAYED_KEYWORDS).map((keyword) => (
                                                <span key={keyword} className="px-2 py-0.5 rounded-md bg-green-50 text-green-600 text-xs border border-green-200">
                                                    {keyword}
                                                </span>
                                            ))}
                                        </div>
                                    </div>
                                )}

                                {analysisResult.keywords_manquants.length > 0 && (
                                    <div>
                                        <p className="text-xs font-semibold text-black/50 mb-1.5">Mots manquants ✗</p>
                                        <div className="flex flex-wrap gap-1.5">
                                            {analysisResult.keywords_manquants.slice(0, MAX_DISPLAYED_KEYWORDS).map((keyword) => (
                                                <span key={keyword} className="px-2 py-0.5 rounded-md bg-red-50 text-red-400 text-xs border border-red-200">
                                                    {keyword}
                                                </span>
                                            ))}
                                        </div>
                                    </div>
                                )}

                                {analysisResult.suggestions && analysisResult.suggestions.length > 0 && (
                                    <div>
                                        <p className="text-xs font-semibold text-black/50 mb-1.5">Suggestions</p>
                                        <ul className="space-y-1.5 text-xs text-black/55">
                                            {analysisResult.suggestions.map((suggestion) => (
                                                <li key={suggestion} className="rounded-lg bg-thepurple/5 px-3 py-2">
                                                    {suggestion}
                                                </li>
                                            ))}
                                        </ul>
                                    </div>
                                )}
                            </div>
                        )}
                    </div>
                </div>
            )}

            {isConfirmationOpen && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4">
                    <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-ombre">
                        <h2 className="mb-2 text-lg font-bold text-black/80">Candidature envoyée</h2>
                        <p className="mb-4 text-sm text-black/50">
                            Votre candidature a bien été transmise. Vous pouvez suivre son avancement depuis votre page candidatures.
                        </p>
                        <div className="flex gap-2">
                            <button
                                onClick={() => setIsConfirmationOpen(false)}
                                className="flex-1 rounded-xl border border-black/10 px-4 py-2 text-sm font-semibold text-black/50"
                            >
                                Fermer
                            </button>
                            <Link
                                href="/applications"
                                className="flex-1 rounded-xl bg-thepurple px-4 py-2 text-center text-sm font-semibold text-white"
                            >
                                Suivre
                            </Link>
                        </div>
                    </div>
                </div>
            )}
        </main>
    );
}
