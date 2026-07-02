import { CheckIcon } from "@heroicons/react/20/solid";
import clsx from "clsx";

const steps = [
  { name: "7j", href: "#", status: "complete" },
  { name: "14j", href: "#", status: "complete" },
  { name: "30j", href: "#", status: "current" },
  { name: "90j", href: "#", status: "upcoming" },
  { name: "All", href: "#", status: "upcoming" },
];

export function AdminTimeframeSelector() {
  return (
    <nav aria-label="Progress">
      <ol role="list" className="flex items-center">
        {steps.map((step, stepIdx) => (
          <li key={step.name} className="relative flex items-center">
            {stepIdx !== 0 && (
              <div
                aria-hidden="true"
                className="h-[2px] w-3 bg-white/[0.03] mx-2"
              />
            )}
            {step.status === "complete" ? (
              <a
                href={step.href}
                className="group relative flex items-center gap-1.5"
              >
                <span className="flex h-5 items-center">
                  <span className="relative z-10 flex size-3.5 items-center justify-center rounded-full bg-indigo-500 group-hover:bg-indigo-600">
                    <CheckIcon
                      aria-hidden="true"
                      className="size-2.5 text-white"
                    />
                  </span>
                </span>
                <span className="text-[10px] font-bold uppercase tracking-widest text-white">
                  {step.name}
                </span>
              </a>
            ) : step.status === "current" ? (
              <a
                href={step.href}
                aria-current="step"
                className="group relative flex items-center gap-1.5"
              >
                <span aria-hidden="true" className="flex h-5 items-center">
                  <span className="relative z-10 flex size-3.5 items-center justify-center rounded-full border-2 border-indigo-500 bg-white/[0.02]">
                    <span className="size-1.5 rounded-full bg-indigo-500" />
                  </span>
                </span>
                <span className="text-[10px] font-bold uppercase tracking-widest text-indigo-400">
                  {step.name}
                </span>
              </a>
            ) : (
              <a
                href={step.href}
                className="group relative flex items-center gap-1.5"
              >
                <span aria-hidden="true" className="flex h-5 items-center">
                  <span className="relative z-10 flex size-3.5 items-center justify-center rounded-full border-2 border-white/[0.08] bg-white/[0.02] group-hover:border-white/[0.12]">
                    <span className="size-1.5 rounded-full bg-transparent group-hover:bg-white/[0.08]" />
                  </span>
                </span>
                <span className="text-[10px] font-bold uppercase tracking-widest text-zinc-500">
                  {step.name}
                </span>
              </a>
            )}
          </li>
        ))}
      </ol>
    </nav>
  );
}
