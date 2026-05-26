import { Logoforbg } from '../assets/logo2'

export default function Background() {
    return (
        <div className="pointer-events-none fixed inset-0 z-0 overflow-hidden">
            <Logoforbg className="starz-bg-mark starz-float absolute top-25 left-30 w-[900px] h-[900px] opacity-10" />
            <Logoforbg className="starz-bg-mark hidden md:block starz-float-slow absolute -bottom-220 -right-200 w-[2000px] h-[2000px] opacity-17.5" />
            <Logoforbg className="starz-bg-mark hidden md:block starz-float-reverse absolute right-165 w-[350px] h-[350px] opacity-10" />
            <Logoforbg className="starz-bg-mark hidden md:block starz-float-slow absolute top-10 w-[400px] h-[400px] opacity-5" />
        </div>
    )
}
