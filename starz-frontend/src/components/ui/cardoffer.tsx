import Link from "next/link"
import { iOffers } from "../schemas/offerapi"
import { Logoforbg } from "../assets/logo2"
import { IoLocationSharp } from "react-icons/io5"
import { formatContractType, formatRemotePolicy, formatSalary } from "@/lib/offerLabels"
import { FaHeart } from "react-icons/fa"
import { decodeHtmlEntities } from "@/lib/html"

type Props = {
    offer: iOffers
    isFavorite?: boolean
}

export default function Cardoffer({ offer, isFavorite = false }: Props) {
    const { premium } = offer;
    const contractType = formatContractType(offer.contractType);
    const remotePolicy = formatRemotePolicy(offer.remotePolicy);

    const salary = formatSalary(offer);

    return (
        <Link href={`/offers/${offer.id}`} className="w-full">
        <div className={`relative flex flex-col w-full px-5 py-4 gap-2 ${premium ? "border-2 border-thepurple/50" : "border border-thepurple/10"} rounded-2xl bg-white shadow-ombre cursor-pointer hover:shadow-md transition-shadow duration-150`}>
            {premium && <Logoforbg className="absolute right-3 top-3 w-12 h-12 opacity-70" />}

            <div className="flex flex-col gap-0.5">
                <span className="text-sm text-black/50 font-medium">{offer.companyName}</span>
                <span className="flex items-start gap-2 pr-14 text-base font-bold text-black/85">
                    <span>{decodeHtmlEntities(offer.title)}</span>
                    {isFavorite && <FaHeart className="mt-1 h-3.5 w-3.5 shrink-0 text-rose-500" />}
                </span>
            </div>

            <div className="flex flex-wrap items-center gap-2">
                {offer.location && (
                    <span className="flex items-center gap-1 text-sm text-black/55">
                        <IoLocationSharp className="w-4 h-4 shrink-0" />
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
                {salary && (
                    <span className="text-sm text-black/55 font-medium">{salary}</span>
                )}
            </div>

            {offer.skills.length > 0 && (
                <div className="flex flex-wrap gap-1.5">
                    {offer.skills.slice(0, 5).map((skill) => (
                        <span key={skill.id} className="px-2 py-0.5 rounded-md bg-black/5 text-black/60 text-xs">
                            {skill.name}
                        </span>
                    ))}
                    {offer.skills.length > 5 && (
                        <span className="px-2 py-0.5 rounded-md bg-black/5 text-black/60 text-xs">
                            +{offer.skills.length - 5}
                        </span>
                    )}
                </div>
            )}
        </div>
        </Link>
    )
}
