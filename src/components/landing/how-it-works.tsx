"use client";

import { useState, useCallback, memo } from "react";
import { Upload, FolderOpen, CalendarCheck } from "lucide-react";

const steps = [
  {
    step: "1",
    icon: <Upload className="h-5 w-5" />,
    title: "Import or add your leads",
    desc: "Paste a CSV or add contacts one by one. Takes less than a minute.",
  },
  {
    step: "2",
    icon: <FolderOpen className="h-5 w-5" />,
    title: "Set your pipeline stage",
    desc: "New → Contacted → Showing → Offer → Closed. Tap to update.",
  },
  {
    step: "3",
    icon: <CalendarCheck className="h-5 w-5" />,
    title: "Open the app each morning",
    desc: "See exactly who to call today. Nothing else. Just the list.",
  },
];

const StepItem = memo(function StepItem({
  item,
  isActive,
  onSelect,
}: {
  item: (typeof steps)[number];
  isActive: boolean;
  onSelect: () => void;
}) {
  return (
    <div className="relative">
      <div className="flex items-center gap-4 mb-4">
        <button
          type="button"
          onClick={onSelect}
          aria-current={isActive ? "step" : undefined}
          className={`w-12 h-12 rounded-2xl flex items-center justify-center font-heading text-lg font-bold shrink-0 transition-all duration-200 cursor-pointer ${
            isActive
              ? "bg-primary text-white"
              : "bg-surface-100 text-surface-500 hover:bg-surface-200 hover:text-surface-700"
          }`}
        >
          {item.step}
        </button>
        <div
          className={`w-10 h-10 rounded-lg flex items-center justify-center transition-colors duration-200 ${
            isActive
              ? "bg-primary-50 text-primary"
              : "bg-surface-50 text-surface-500"
          }`}
        >
          {item.icon}
        </div>
      </div>
      <h3 className="font-heading font-semibold text-surface-900 mb-2">
        {item.title}
      </h3>
      <p className="text-sm text-surface-500 leading-relaxed">{item.desc}</p>
    </div>
  );
});

export function HowItWorks() {
  const [active, setActive] = useState(0);

  const handleSelect = useCallback((index: number) => {
    setActive(index);
  }, []);

  return (
    <section id="how-it-works" className="py-20 sm:py-24 px-4 sm:px-6">
      <div className="max-w-3xl mx-auto text-center">
        <h2 className="section-heading mb-4">
          Up and running in 3 minutes
        </h2>
        <p className="section-subheading mb-12">
          Already in Follow Up Boss or a spreadsheet? Import your contacts in one click.
        </p>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-8 text-left">
          {steps.map((item, i) => (
            <StepItem
              key={i}
              item={item}
              isActive={i === active}
              onSelect={() => handleSelect(i)}
            />
          ))}
        </div>
      </div>
    </section>
  );
}
