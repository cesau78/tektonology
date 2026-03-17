import { Card, CardContent } from "@/components/ui/card";

export function LoadingState() {
  return (
    <Card className="shadow-sm">
      <CardContent className="pt-6 text-center text-muted-foreground text-sm">
        Loading...
      </CardContent>
    </Card>
  );
}

export function ErrorState({ message }: { message: string }) {
  return (
    <Card className="shadow-sm border-red-300">
      <CardContent className="pt-6 text-center">
        <p className="text-red-700 font-medium text-sm mb-1">Unable to load data</p>
        <p className="text-muted-foreground text-xs">{message}</p>
        <p className="text-muted-foreground text-xs mt-2">
          Make sure the tektonology-api server is running on localhost:3001
        </p>
      </CardContent>
    </Card>
  );
}
