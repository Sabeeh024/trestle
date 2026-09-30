import type { Meta, StoryObj } from "@storybook/react-vite";

const meta = {
  title: "Design Tokens/Typography",
  parameters: { layout: "padded" },
} satisfies Meta;

export default meta;
type Story = StoryObj<typeof meta>;

const sizes = [
  { className: "text-xs", label: "xs — 12px" },
  { className: "text-sm", label: "sm — 14px" },
  { className: "text-base", label: "base — 16px" },
  { className: "text-lg", label: "lg — 18px" },
  { className: "text-xl", label: "xl — 20px" },
  { className: "text-2xl", label: "2xl — 24px" },
  { className: "text-3xl", label: "3xl — 30px" },
  { className: "text-4xl", label: "4xl — 36px" },
];

const weights = [
  { className: "font-normal", label: "normal (400)" },
  { className: "font-medium", label: "medium (500)" },
  { className: "font-semibold", label: "semibold (600)" },
  { className: "font-bold", label: "bold (700)" },
];

export const Scale: Story = {
  render: () => (
    <div className="flex flex-col gap-4">
      {sizes.map((size) => (
        <div key={size.className} className="flex items-baseline gap-4">
          <span className="w-32 shrink-0 font-mono text-xs text-text-disabled">{size.label}</span>
          <span className={`${size.className} font-semibold text-text-primary`}>
            The quick brown fox
          </span>
        </div>
      ))}
    </div>
  ),
};

export const Weights: Story = {
  render: () => (
    <div className="flex flex-col gap-3">
      {weights.map((weight) => (
        <div key={weight.className} className="flex items-baseline gap-4">
          <span className="w-40 shrink-0 font-mono text-xs text-text-disabled">{weight.label}</span>
          <span className={`${weight.className} text-lg text-text-primary`}>
            The quick brown fox jumps
          </span>
        </div>
      ))}
    </div>
  ),
};
