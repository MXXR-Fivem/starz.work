export default function Hero() {
    return (
        <div className="flex flex-col items-center justify-center gap-3 px-4 sm:px-8 text-center mt-8 sm:mt-10">
            <h1 className="text-4xl sm:text-5xl md:text-6xl lg:text-7xl font-black tracking-tight text-black/70 leading-tight">
                Shine brighter with{" "}
                <span className="text-thepurple relative inline-block">
                    Starz
                    <svg className="absolute -bottom-2 left-0 w-full" viewBox="0 0 200 12" fill="none">
                        <path d="M2 8 Q100 2 198 8" stroke="var(--starz-color-primary)" strokeWidth="3" strokeLinecap="round" opacity="0.4"/>
                    </svg>
                </span>
            </h1>
            <p className="text-base sm:text-xl text-black/45 font-medium max-w-3xl">
                Des milliers d&apos;offres de stages, alternances et emplois pensées pour les étudiants et jeunes diplômés.
            </p>
        </div>
    )
}
