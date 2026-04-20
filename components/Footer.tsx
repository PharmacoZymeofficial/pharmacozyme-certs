import Image from "next/image";

export default function Footer() {
  return (
    <footer className="w-full border-t border-stone-100 bg-white pt-8 sm:pt-12 pb-6 sm:pb-8 mt-12 sm:mt-20">
      <div className="flex flex-col items-center justify-center gap-3 sm:gap-4 px-4 text-center">
        {/* Logo with Image — links to pharmacozyme.com */}
        <a
          href="https://pharmacozyme.com"
          target="_blank"
          rel="noopener noreferrer"
          className="flex items-center gap-2 hover:opacity-80 transition-opacity"
        >
          <div className="relative w-8 h-8 sm:w-10 sm:h-10">
            <Image 
              src="/pharmacozyme-logo.png" 
              alt="PharmacoZyme Logo" 
              fill
              className="object-contain"
            />
          </div>
          <span className="font-headline font-semibold text-green-700 text-lg sm:text-xl">
            PharmacoZyme
          </span>
        </a>
        
        <div className="flex flex-wrap justify-center gap-4 sm:gap-6 md:gap-8 px-4">
          <a className="font-body text-[11px] sm:text-xs text-stone-400 hover:text-green-600 transition-colors duration-150" href="#">
            Privacy Policy
          </a>
          <a className="font-body text-[11px] sm:text-xs text-stone-400 hover:text-green-600 transition-colors duration-150" href="#">
            Terms of Service
          </a>
          <a className="font-body text-[11px] sm:text-xs text-stone-400 hover:text-green-600 transition-colors duration-150" href="#">
            API Documentation
          </a>
          <a className="font-body text-[11px] sm:text-xs text-stone-400 hover:text-green-600 transition-colors duration-150" href="#">
            Contact Compliance
          </a>
        </div>
        <p className="font-body text-[11px] sm:text-xs text-stone-500">
          © 2024 PharmacoZyme. Advanced Clinical Verification Systems.
        </p>
        <div className="pt-2 sm:pt-4">
          <div className="w-12 h-0.5 bg-green-600/20 mx-auto"></div>
        </div>
      </div>
    </footer>
  );
}
