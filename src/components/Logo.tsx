import React from 'react';
import { cn } from '../lib/utils';

interface LogoProps {
    className?: string;
    showText?: boolean;
}

export default function Logo({ className, showText = true }: LogoProps) {
    return (
        <div className={cn("flex items-center justify-center", className)}>
            <img
                src="/logo_samco.png"
                alt="SAMCO VINA LOGO"
                className="w-full h-full object-contain"
            />
        </div>
    );
}
