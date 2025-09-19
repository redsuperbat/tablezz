import { useSuspenseQuery } from "@tanstack/react-query";
import { toast } from "sonner";
import { createReactContext } from "@/createReactContext";
import { ConfigurationService } from "./ConfigurationService";

export const [ConfigurationProvider, , useConfig] = createReactContext(() => {
	const { data } = useSuspenseQuery({
		queryFn: () =>
			ConfigurationService.init((message) =>
				toast.error(
					`Loading config failed, falling back to default configuration: ${message}`,
				),
			),
		queryKey: [],
		refetchOnWindowFocus: false,
	});

	return data;
});
