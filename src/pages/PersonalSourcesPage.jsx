import React from "react";
import { Link } from "react-router-dom";
import PersonalMoviSource from "@/components/mg/PersonalMoviSource";

export default function PersonalSourcesPage() {
  return (
    <main className="min-h-screen bg-mg-background p-4 text-white sm:p-6">
      <div className="mx-auto max-w-5xl">
        <Link to="/" className="text-sm font-semibold text-mg-green">← Back to Media God</Link>
        <h1 className="mt-4 text-2xl font-bold">Personal Sources</h1>
        <PersonalMoviSource defaultOpen />
      </div>
    </main>
  );
}
