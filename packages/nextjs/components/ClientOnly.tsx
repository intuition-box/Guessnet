"use client";

import { useEffect, useState } from "react";

interface ClientOnlyProps {
  children: React.ReactNode;
  fallback?: React.ReactNode;
}

export default function ClientOnly({ children, fallback }: ClientOnlyProps) {
  const [hasMounted, setHasMounted] = useState(false);

  useEffect(() => {
    setHasMounted(true);
  }, []);

  if (!hasMounted) {
    return fallback || (
      <div className="min-h-screen bg-gray-900 flex items-center justify-center">
        <div className="loading loading-spinner loading-lg text-violet-400"></div>
      </div>
    );
  }

  return <>{children}</>;
}