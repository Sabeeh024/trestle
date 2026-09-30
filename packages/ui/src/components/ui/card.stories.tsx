import type { Meta, StoryObj } from "@storybook/react-vite";

import { Button } from "./button";
import { Card, CardAction, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "./card";

const meta = {
  title: "Components/Card",
  component: Card,
  tags: ["autodocs"],
} satisfies Meta<typeof Card>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  render: () => (
    <Card className="w-80">
      <CardHeader>
        <CardTitle>Website Redesign</CardTitle>
        <CardDescription>Refresh the marketing site&apos;s visual language.</CardDescription>
        <CardAction>
          <Button variant="ghost" size="icon-sm">
            ⋯
          </Button>
        </CardAction>
      </CardHeader>
      <CardContent>
        <p className="text-sm text-text-secondary">4 of 12 tasks complete</p>
      </CardContent>
      <CardFooter>
        <Button size="sm" variant="outline" className="w-full">
          View project
        </Button>
      </CardFooter>
    </Card>
  ),
};
