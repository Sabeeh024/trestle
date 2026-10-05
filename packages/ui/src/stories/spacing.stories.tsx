import type { Meta, StoryObj } from "@storybook/react-vite";

const meta = {
  title: "Design Tokens/Spacing",
  parameters: { layout: "padded" },
} satisfies Meta;

export default meta;
type Story = StoryObj<typeof meta>;

const steps = [
  { className: "w-1", label: "1 — 4px" },
  { className: "w-2", label: "2 — 8px" },
  { className: "w-3", label: "3 — 12px" },
  { className: "w-4", label: "4 — 16px" },
  { className: "w-5", label: "5 — 20px" },
  { className: "w-6", label: "6 — 24px" },
  { className: "w-8", label: "8 — 32px" },
  { className: "w-10", label: "10 — 40px" },
  { className: "w-12", label: "12 — 48px" },
  { className: "w-16", label: "16 — 64px" },
  { className: "w-20", label: "20 — 80px" },
  { className: "w-24", label: "24 — 96px" },
];

export const Scale: Story = {
  render: () => (
    <div className="flex flex-col gap-3">
      {steps.map((step) => (
        <div key={step.className} className="flex items-center gap-4">
          <span className="w-24 shrink-0 font-mono text-xs text-text-tertiary">{step.label}</span>
          <div className={`h-4 rounded-sm bg-action-primary ${step.className}`} />
        </div>
      ))}
    </div>
  ),
};

const radii = [
  { className: "rounded-none", label: "none" },
  { className: "rounded-sm", label: "sm" },
  { className: "rounded-md", label: "md" },
  { className: "rounded-lg", label: "lg" },
  { className: "rounded-xl", label: "xl" },
  { className: "rounded-full", label: "full" },
];

export const Radius: Story = {
  render: () => (
    <div className="flex flex-wrap items-center gap-6">
      {radii.map((radius) => (
        <div key={radius.className} className="flex flex-col items-center gap-2">
          <div className={`size-14 border border-border bg-background-muted ${radius.className}`} />
          <span className="font-mono text-xs text-text-tertiary">{radius.label}</span>
        </div>
      ))}
    </div>
  ),
};
