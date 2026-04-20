import Image from "next/image";

export default function Navbar() {
  return (
    <nav className="fixed top-0 w-full z-50 bg-white/80 backdrop-blur-xl shadow-sm shadow-green-900/5">
      <div className="flex justify-between items-center px-4 sm:px-6 lg:px-8 h-14 sm:h-16 max-w-full mx-auto">
        {/* Logo with Image */}
        <div className="flex items-center gap-2 sm:gap-3">
          <div className="relative w-8 h-8 sm:w-10 sm:h-10">
            <Image 
              src="/pharmacozyme-logo.png" 
              alt="PharmacoZyme Logo" 
              fill
              sizes="40px"
              className="object-contain"
              priority
            />
          </div>
          <span className="font-headline text-lg sm:text-2xl font-bold text-green-800">
            PharmacoZyme
          </span>
        </div>

        {/* Desktop Navigation */}
        <div className="hidden md:flex items-center space-x-8">
          <a
            href="/verify"
            className="font-body font-medium text-sm text-green-700 border-b-2 border-green-600 pb-1"
          >
            Verification
          </a>
          <a
            href="https://wa.me/923700199429"
            target="_blank"
            rel="noopener noreferrer"
            className="font-body font-medium text-sm text-stone-600 hover:text-green-600 transition-colors flex items-center gap-1.5"
          >
            Support
          </a>
        </div>
      </div>
    </nav>
  );
}
