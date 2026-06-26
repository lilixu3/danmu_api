import { useQuery } from "@tanstack/react-query";
import { buildApiUrl, type RequestRecord } from "@/lib/api";

export interface RequestRecordsData {
  records: RequestRecord[];
  todayReqNum: number;
}

export function useRequestRecords() {
  return useQuery<RequestRecordsData>({
    queryKey: ["reqrecords"],
    queryFn: async () => {
      const res = await fetch(buildApiUrl("/api/reqrecords"));
      if (!res.ok) throw new Error("无法获取请求记录");
      return res.json();
    },
  });
}
