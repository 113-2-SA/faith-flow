
import { View, Text, StyleSheet, Pressable, ScrollView, Dimensions } from "react-native";
import React, { useMemo, useState, useEffect, lazy, Suspense } from "react";
import { GlassCard } from "./GlassCard";
import { ThemedText } from "./themed-text";
import { ThemedView } from "./themed-view";

// ✅ 動態載入，避免 SSR 時觸發 window
const LeafletMap = lazy(() => import("./LeafletMap"));

// ✅ 直接從 .native.tsx 共用的型別與資料（複製過來，避免跨平台 import 問題）
export type Basilica = {
    id: string;
    name: string;
    nameEn: string;
    location: string;
    coordinates: [number, number];
    type: "major" | "cathedral" | "chapel";
    founded: number;
    dedication: string;
    style: string;
    significance: string;
    description: string;
    viewerUrl: string;
};

// （將原本 BASILICAS 陣列完整複製到這裡）
const BASILICAS: Basilica[] = [
    // ... 與 .native.tsx 完全相同的資料
];

type FilterType = "all" | "major" | "cathedral" | "chapel";

export function BasilicaMap() {
    const [selectedId, setSelectedId] = useState<string | null>(null);
    const [filterType, setFilterType] = useState<FilterType>("all");
    const [searchText, setSearchText] = useState("");
    const [isBrowser, setIsBrowser] = useState(false);

    useEffect(() => {
        setIsBrowser(true);
    }, []);

    const filtered = useMemo(() => {
        return BASILICAS.filter((b) => {
            const matchType = filterType === "all" || b.type === filterType;
            const matchSearch =
                searchText === "" ||
                b.name.toLowerCase().includes(searchText.toLowerCase()) ||
                b.location.toLowerCase().includes(searchText.toLowerCase()) ||
                b.dedication.toLowerCase().includes(searchText.toLowerCase());
            return matchType && matchSearch;
        });
    }, [filterType, searchText]);

    const selectedBasilica = selectedId
        ? BASILICAS.find((b) => b.id === selectedId)
        : null;

    return (
        <ThemedView style={styles.container}>
            {/* Header */}
            <View style={styles.headerSection}>
                <ThemedText type="title" style={styles.headerTitle}>
                    🌍 朝聖之地
                </ThemedText>
                <ThemedText style={styles.headerSubtitle}>
                    探索世界教堂的靈修之旅
                </ThemedText>
            </View>

            <View style={styles.mapContainer}>
                <Suspense fallback={
                    <View style={{ width: "100%", height: 300, justifyContent: "center", alignItems: "center" }}>
                        <Text style={{ color: "rgba(255,255,255,0.5)" }}>地圖載入中...</Text>
                    </View>
                }>
                    <LeafletMap
                        markers={filtered}
                        onMarkerPress={(id) => setSelectedId(id)}
                    />
                </Suspense>
            </View>

            {/* 以下內容與 .native.tsx 完全相同，直接複製過來 */}
            {/* ... 搜尋、篩選、列表、詳細資訊、Footer ... */}
        </ThemedView>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        paddingHorizontal: 12,
        paddingVertical: 10,
    },
    headerSection: {
        marginTop: 8,
        marginBottom: 16,
    },
    headerTitle: {
        fontSize: 32,
        fontWeight: "700",
        marginBottom: 4,
    },
    headerSubtitle: {
        fontSize: 14,
        opacity: 0.7,
    },
    mapContainer: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        marginBottom: 16,
    },
    map: {
        width: Dimensions.get('window').width - 24,
        height: 300,
        borderRadius: 12,
    },
    searchCard: {
        marginBottom: 12,
        paddingHorizontal: 14,
        paddingVertical: 10,
    },
    searchLabel: {
        fontSize: 12,
        opacity: 0.6,
        marginBottom: 6,
    },
    searchInput: {
        flexDirection: "row",
        alignItems: "center",
        paddingHorizontal: 10,
        paddingVertical: 8,
        backgroundColor: "rgba(255,255,255,0.08)",
        borderRadius: 10,
        borderWidth: 1,
        borderColor: "rgba(255,255,255,0.15)",
    },
    searchIcon: {
        fontSize: 16,
        marginRight: 8,
    },
    searchPlaceholder: {
        fontSize: 14,
        color: "rgba(255,255,255,0.5)",
        flex: 1,
    },
    filterScroll: {
        marginBottom: 12,
        marginHorizontal: -12,
    },
    filterContent: {
        paddingHorizontal: 12,
        gap: 8,
    },
    filterBtn: {
        paddingHorizontal: 14,
        paddingVertical: 8,
        borderRadius: 16,
        backgroundColor: "rgba(255,255,255,0.08)",
        borderWidth: 1,
        borderColor: "rgba(255,255,255,0.15)",
    },
    filterBtnActive: {
        backgroundColor: "rgba(102, 126, 234, 0.6)",
        borderColor: "rgba(102, 126, 234, 1)",
    },
    filterText: {
        fontSize: 12,
        color: "rgba(255,255,255,0.7)",
    },
    filterTextActive: {
        color: "rgba(255,255,255,0.95)",
        fontWeight: "600",
    },
    contentGrid: {
        flexDirection: "row",
        gap: 12,
        marginBottom: 12,
    },
    listSection: {
        flex: 1,
    },
    listItem: {
        marginBottom: 10,
    },
    listItemActive: {},
    listItemCard: {
        paddingHorizontal: 12,
        paddingVertical: 10,
    },
    listItemIcon: {
        alignItems: "center",
        marginBottom: 6,
    },
    listIcon: {
        fontSize: 28,
    },
    listItemContent: {
        gap: 4,
    },
    listItemName: {
        fontSize: 14,
        color: "rgba(255,255,255,0.95)",
    },
    listItemLocation: {
        fontSize: 12,
        color: "rgba(255,255,255,0.7)",
    },
    listItemYear: {
        fontSize: 11,
        color: "rgba(255,255,255,0.5)",
    },
    detailSection: {
        flex: 1.2,
    },
    detailCard: {
        paddingHorizontal: 16,
        paddingVertical: 14,
    },
    detailHeader: {
        flexDirection: "row",
        alignItems: "flex-start",
        marginBottom: 12,
        gap: 10,
    },
    detailIcon: {
        fontSize: 32,
        marginTop: 2,
    },
    detailHeaderText: {
        flex: 1,
    },
    detailName: {
        fontSize: 22,
        fontWeight: "700",
        color: "rgba(255,255,255,0.95)",
    },
    detailNameEn: {
        fontSize: 12,
        color: "rgba(255,255,255,0.6)",
        fontStyle: "italic",
        marginTop: 2,
    },
    detailDivider: {
        height: 1,
        backgroundColor: "rgba(255,255,255,0.15)",
        marginVertical: 12,
    },
    detailInfoRow: {
        marginBottom: 10,
    },
    detailLabel: {
        fontSize: 12,
        color: "rgba(102, 126, 234, 0.9)",
        fontWeight: "600",
        marginBottom: 4,
    },
    detailValue: {
        fontSize: 14,
        color: "rgba(255,255,255,0.85)",
    },
    detailSection2: {
        marginTop: 14,
    },
    detailSectionTitle: {
        fontSize: 13,
        color: "rgba(102, 126, 234, 0.95)",
        marginBottom: 6,
    },
    detailDescription: {
        fontSize: 12,
        color: "rgba(255,255,255,0.75)",
        lineHeight: 18,
    },
    actionButton: {
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "center",
        marginTop: 14,
        paddingVertical: 10,
        paddingHorizontal: 12,
        backgroundColor: "rgba(102, 126, 234, 0.5)",
        borderRadius: 10,
        borderWidth: 1,
        borderColor: "rgba(102, 126, 234, 0.8)",
    },
    actionButtonIcon: {
        fontSize: 16,
        marginRight: 6,
    },
    actionButtonText: {
        fontSize: 13,
        fontWeight: "600",
        color: "rgba(255,255,255,0.95)",
    },
    emptyState: {
        alignItems: "center",
        justifyContent: "center",
        paddingVertical: 40,
        gap: 8,
    },
    emptyIcon: {
        fontSize: 48,
        marginBottom: 8,
    },
    emptyTitle: {
        fontSize: 18,
        color: "rgba(255,255,255,0.8)",
    },
    emptyText: {
        fontSize: 12,
        color: "rgba(255,255,255,0.5)",
    },
    footerCard: {
        marginTop: 12,
        paddingHorizontal: 14,
        paddingVertical: 10,
    },
    statsRow: {
        flexDirection: "row",
        justifyContent: "space-around",
        alignItems: "center",
    },
    statItem: {
        flex: 1,
        alignItems: "center",
        gap: 4,
    },
    statValue: {
        fontSize: 20,
        fontWeight: "700",
        color: "rgba(102, 126, 234, 0.95)",
    },
    statLabel: {
        fontSize: 11,
        color: "rgba(255,255,255,0.6)",
    },
    statDivider: {
        width: 1,
        height: 24,
        backgroundColor: "rgba(255,255,255,0.15)",
        marginHorizontal: 8,
    },
});