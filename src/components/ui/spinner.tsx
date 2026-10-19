import { LoadingRing } from "@/components/ui/loading-ring"

export function Spinner({ className, size = 24 }: { className?: string, size?: number }) {
  return <LoadingRing size={size} className={className} />
}

export default Spinner
