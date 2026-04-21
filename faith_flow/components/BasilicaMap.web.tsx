
import { View, Text, StyleSheet, Pressable, ScrollView, TextInput } from "react-native";
import React, { useMemo, useState, useEffect, useRef, lazy, Suspense } from "react";
import { ChurchPanoramaViewer } from "./ChurchPanoramaViewer";
import { ChurchVideoViewer } from "./ChurchVideoViewer";
import { GlassCard } from "./GlassCard";
import { ThemedText } from "./themed-text";
import { ThemedView } from "./themed-view";
import { db } from "../lib/firebase";
import { collection, getDocs, query, orderBy } from "firebase/firestore";

// ✅ 動態載入 Google Maps 組件，避免 SSR 時出錯
const GoogleMapsComponent = lazy(() => import("./GoogleMapsComponent.web"));

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
    panoramaId?: string | null;
    panoramaHeading?: number;
    videoUrl?: string | null;
};

type FilterType = "all" | "major" | "cathedral" | "chapel";

export function BasilicaMap() {
    const [basilicas, setBasilicas] = useState<Basilica[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [selectedId, setSelectedId] = useState<string | null>(null);
    const [filterType, setFilterType] = useState<FilterType>("all");
    const [searchText, setSearchText] = useState("");
    const scrollViewRef = useRef<ScrollView>(null);
    const [detailY, setDetailY] = useState(0);
    const [displayCount, setDisplayCount] = useState(3);
    const [showPanorama, setShowPanorama] = useState(false);
    const [showVideo, setShowVideo] = useState(false);

    // 切換教堂時關閉全景與影片
    useEffect(() => {
        setShowPanorama(false);
        setShowVideo(false);
    }, [selectedId]);

    useEffect(() => {
        const fetchBasilicas = async () => {
            try {
                setLoading(true);
                const q = query(collection(db, "basilicas"), orderBy("name"));
                const querySnapshot = await getDocs(q);
                const basilicasData: Basilica[] = [];
                querySnapshot.forEach((doc) => {
                    const data = doc.data();
                    basilicasData.push({
                        id: doc.id,
                        name: data.name,
                        nameEn: data.nameEn,
                        location: data.location,
                        coordinates: data.coordinates,
                        type: data.type,
                        founded: data.founded,
                        dedication: data.dedication,
                        style: data.style,
                        significance: data.significance,
                        description: data.description,
                        viewerUrl: data.viewerUrl,
                        panoramaId: data.panoramaId || null,
                        panoramaHeading: data.panoramaHeading ?? undefined,
                        videoUrl: data.videoUrl || null,
                    });
                });
                setBasilicas(basilicasData);
            } catch (err) {
                console.error("Error fetching basilicas:", err);
                setError("Failed to load basilicas data");
            } finally {
                setLoading(false);
            }
        };

        fetchBasilicas();
    }, []);

    const filtered = useMemo(() => {
        return basilicas.filter((b) => {
            const matchType = filterType === "all" || b.type === filterType;
            const matchSearch =
                searchText === "" ||
                b.name.toLowerCase().includes(searchText.toLowerCase()) ||
                b.location.toLowerCase().includes(searchText.toLowerCase()) ||
                b.dedication.toLowerCase().includes(searchText.toLowerCase());
            return matchType && matchSearch;
        });
    }, [basilicas, filterType, searchText]);

    // 當篩選條件改變時，重置顯示數量為 3
    useEffect(() => {
        setDisplayCount(3);
    }, [filterType, searchText]);

    // 當搜尋文字完全匹配教堂名稱時，自動選擇該教堂
    useEffect(() => {
        const trimmed = searchText.trim();
        if (trimmed !== "") {
            const exactMatch = basilicas.find(b => 
                b.name.toLowerCase() === trimmed.toLowerCase() ||
                b.nameEn.toLowerCase() === trimmed.toLowerCase()
            );
            if (exactMatch) {
                setSelectedId(exactMatch.id);
            }
        }
    }, [searchText, basilicas]);

    const displayedBasilicas = filtered.slice(0, displayCount);

    const selectedBasilica = selectedId
        ? basilicas.find((b) => b.id === selectedId)
        : null;

    // 當選中教堂時，畫面自動滾動到教堂介紹區塊
    useEffect(() => {
        if (selectedId && detailY > 0) {
            setTimeout(() => {
                scrollViewRef.current?.scrollTo({
                    y: detailY - 10, // 稍微預留一點上方間距
                    animated: true,
                });
            }, 100);
        }
    }, [selectedId, detailY]);

    if (loading) {
        return (
            <ThemedView style={styles.scrollRoot}>
                <View style={styles.loadingContainer}>
                    <Text style={styles.loadingText}>載入教堂資料中...</Text>
                </View>
            </ThemedView>
        );
    }

    if (error) {
        return (
            <ThemedView style={styles.scrollRoot}>
                <View style={styles.errorContainer}>
                    <Text style={styles.errorText}>{error}</Text>
                </View>
            </ThemedView>
        );
    }

    return (
        <View style={{ flex: 1 }}>
        <ScrollView
            ref={scrollViewRef}
            style={styles.scrollRoot}
            contentContainerStyle={styles.container}
            scrollEnabled={!showPanorama}
            showsVerticalScrollIndicator={false}
        >
            {/* Header */}
            <View style={styles.headerSection}>
                <ThemedText type="title" style={styles.headerTitle}>
                    <Text style={{ color: "rgb(255, 255, 255)" }}>
                    🌍 朝聖之地
                    </Text>
                </ThemedText>
                <ThemedText style={styles.headerSubtitle}>
                    探索世界教堂的靈修之旅
                </ThemedText>
            </View>

            <View style={styles.mapContainer}>
                <Suspense fallback={
                    <View style={{ width: "90%", height: 300, justifyContent: "center", alignItems: "center", backgroundColor: "rgba(0,0,0,0.1)", borderRadius: 12 }}>
                        <Text style={{ color: "rgba(255,255,255,0.5)" }}>🗺️ 地圖載入中...</Text>
                    </View>
                }>
                    <GoogleMapsComponent
                        markers={filtered}
                        onMarkerPress={(id) => setSelectedId(id)}
                        selectedId={selectedId}
                        autoFitBounds={searchText.trim() !== "" || filterType !== "all"}
                    />
                </Suspense>
            </View>

            {/* Search */}
            <GlassCard style={styles.searchCard} intensity={85}>
                <ThemedText style={styles.searchLabel}>搜尋教堂</ThemedText>
                <View style={styles.searchInput}>
                    <Text style={styles.searchIcon}>🔍</Text>
                    <TextInput
                        style={[styles.searchTextInput, { outline: 'none', caretColor: '#ffffff' } as any]}
                        placeholder="教堂名稱、位置、奉獻對象..."
                        placeholderTextColor="rgba(255,255,255,0.5)"
                        value={searchText}
                        onChangeText={setSearchText}
                    />
                    {searchText.length > 0 && (
                        <Pressable onPress={() => setSearchText("")} style={styles.clearButton}>
                            <Text style={styles.clearButtonText}>✕</Text>
                        </Pressable>
                    )}
                </View>
            </GlassCard>

            {/* Basilica Details Panel */}
            <View onLayout={(e) => setDetailY(e.nativeEvent.layout.y)}>
                {selectedBasilica ? (
                    <View style={styles.detailSection}>
                        <GlassCard style={styles.detailCard} intensity={100}>
                            {/* Header */}
                            <View style={styles.detailHeader}>
                                <Text style={styles.detailIcon}>⛪</Text>
                                <View style={styles.detailHeaderText}>
                                    <ThemedText type="title" style={styles.detailName}>
                                        {selectedBasilica.name}
                                    </ThemedText>
                                    <ThemedText style={styles.detailNameEn}>
                                        {selectedBasilica.nameEn}
                                    </ThemedText>
                                </View>
                            </View>

                            <View style={styles.detailDivider} />

                            {/* Info Rows */}
                            <View style={styles.detailInfoRow}>
                                <ThemedText style={styles.detailLabel}>📍 位置</ThemedText>
                                <ThemedText style={styles.detailValue}>
                                    {selectedBasilica.location}
                                </ThemedText>
                            </View>

                            <View style={styles.detailInfoRow}>
                                <ThemedText style={styles.detailLabel}>⏰ 建立</ThemedText>
                                <ThemedText style={styles.detailValue}>
                                    {selectedBasilica.founded} 年
                                </ThemedText>
                            </View>

                            <View style={styles.detailInfoRow}>
                                <ThemedText style={styles.detailLabel}>✝️ 奉獻給</ThemedText>
                                <ThemedText style={styles.detailValue}>
                                    {selectedBasilica.dedication}
                                </ThemedText>
                            </View>

                            <View style={styles.detailInfoRow}>
                                <ThemedText style={styles.detailLabel}>🎨 建築風格</ThemedText>
                                <ThemedText style={styles.detailValue}>
                                    {selectedBasilica.style}
                                </ThemedText>
                            </View>

                            {/* Description */}
                            <View style={styles.detailSection2}>
                                <ThemedText type="defaultSemiBold" style={styles.detailSectionTitle}>
                                    宗教意義
                                </ThemedText>
                                <ThemedText style={styles.detailDescription}>
                                    {selectedBasilica.significance}
                                </ThemedText>
                            </View>

                            {/* Full Description */}
                            <View style={styles.detailSection2}>
                                <ThemedText type="defaultSemiBold" style={styles.detailSectionTitle}>
                                    介紹
                                </ThemedText>
                                <ThemedText style={styles.detailDescription}>
                                    {selectedBasilica.description}
                                </ThemedText>
                            </View>

                            {/* 查看影片按鈕 */}
                            {selectedBasilica.videoUrl ? (
                                <Pressable
                                    onPress={() => setShowVideo(true)}
                                    style={({ pressed }) => [
                                        styles.videoBtn,
                                        pressed && styles.videoBtnPressed,
                                    ]}
                                >
                                    <View style={styles.videoBtnInner}>
                                        <Text style={styles.videoBtnIcon}>🎬</Text>
                                        <View>
                                            <ThemedText style={styles.videoBtnLabel}>
                                                查看影片
                                            </ThemedText>
                                            <ThemedText style={styles.videoBtnSub}>
                                                教堂介紹影片
                                            </ThemedText>
                                        </View>
                                        <Text style={styles.videoBtnArrow}>›</Text>
                                    </View>
                                </Pressable>
                            ) : null}

                            {/* 360° 全景按鈕 */}
                            {selectedBasilica.panoramaId ? (
                                <Pressable
                                    onPress={() => setShowPanorama(true)}
                                    style={({ pressed }) => [
                                        styles.panoramaBtn,
                                        pressed && styles.panoramaBtnPressed,
                                    ]}
                                >
                                    <View style={styles.panoramaBtnInner}>
                                        <Text style={styles.panoramaBtnIcon}>🌐</Text>
                                        <View>
                                            <ThemedText style={styles.panoramaBtnLabel}>
                                                進入 360° 全景
                                            </ThemedText>
                                            <ThemedText style={styles.panoramaBtnSub}>
                                                互動式環景體驗
                                            </ThemedText>
                                        </View>
                                        <Text style={styles.panoramaBtnArrow}>›</Text>
                                    </View>
                                </Pressable>
                            ) : (
                                <View style={styles.noPanoramaHint}>
                                    <ThemedText style={styles.noPanoramaText}>
                                        此教堂暫無全景資料
                                    </ThemedText>
                                </View>
                            )}
                        </GlassCard>
                    </View>
                ) : (
                    <View style={styles.detailSection}>
                        <GlassCard style={styles.detailCard} intensity={70}>
                            <View style={styles.emptyState}>
                                <Text style={styles.emptyIcon}>🗺️</Text>
                                <ThemedText type="subtitle" style={styles.emptyTitle}>
                                    選擇教堂
                                </ThemedText>
                                <ThemedText style={styles.emptyText}>
                                    在地圖或列表中點擊教堂
                                </ThemedText>
                                <ThemedText style={styles.emptyText}>
                                    查看詳細信息
                                </ThemedText>
                            </View>
                        </GlassCard>
                    </View>
                )}
            </View>

            {/* Filter Tabs */}
            <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                style={styles.filterScroll}
                contentContainerStyle={styles.filterContent}
            >
                {(["all", "major", "cathedral", "chapel"] as FilterType[]).map(
                    (type) => (
                        <Pressable
                            key={type}
                            onPress={() => setFilterType(type)}
                            style={[
                                styles.filterBtn,
                                filterType === type && styles.filterBtnActive,
                            ]}
                        >
                            <ThemedText
                                style={[
                                    styles.filterText,
                                    filterType === type && styles.filterTextActive,
                                ]}
                            >
                                {type === "all"
                                    ? "全部"
                                    : type === "major"
                                        ? "聖殿"
                                        : type === "cathedral"
                                            ? "主教座堂"
                                            : "聖堂"}
                            </ThemedText>
                        </Pressable>
                    )
                )}
            </ScrollView>

            {/* Content Grid - Basilica List */}
            <View style={styles.listSection}>
                {displayedBasilicas.length > 0 ? (
                    <>
                        {displayedBasilicas.map((basilica) => (
                            <Pressable
                                key={basilica.id}
                                onPress={() => setSelectedId(basilica.id)}
                                style={[
                                    styles.listItem,
                                    selectedId === basilica.id && styles.listItemActive,
                                ]}
                            >
                                <GlassCard
                                    intensity={selectedId === basilica.id ? 100 : 70}
                                    style={styles.listItemCard}
                                >
                                    <View style={styles.listItemIcon}>
                                        <Text style={styles.listIcon}>⛪</Text>
                                    </View>
                                    <View style={styles.listItemContent}>
                                        <ThemedText
                                            type="defaultSemiBold"
                                            style={styles.listItemName}
                                        >
                                            {basilica.name}
                                        </ThemedText>
                                        <ThemedText style={styles.listItemLocation}>
                                            📍 {basilica.location}
                                        </ThemedText>
                                        <ThemedText style={styles.listItemYear}>
                                            ⏰ {basilica.founded} 年建立
                                        </ThemedText>
                                    </View>
                                </GlassCard>
                            </Pressable>
                        ))}
                        {filtered.length > displayCount && (
                            <Pressable
                                onPress={() => setDisplayCount((prev) => prev + 3)}
                                style={styles.viewMoreBtn}
                            >
                                <ThemedText style={styles.viewMoreBtnText}>查看更多</ThemedText>
                            </Pressable>
                        )}
                    </>
                ) : (
                    <View style={styles.emptyState}>
                        <Text style={styles.emptyIcon}>🔍</Text>
                        <ThemedText type="subtitle" style={styles.emptyTitle}>
                            未找到教堂
                        </ThemedText>
                        <ThemedText style={styles.emptyText}>
                            試試其他搜尋或篩選條件
                        </ThemedText>
                    </View>
                )}
            </View>

        </ScrollView>

        {/* 影片浮動視窗 */}
        {showVideo && selectedBasilica?.videoUrl && (
            <ChurchVideoViewer
                videoUrl={selectedBasilica.videoUrl}
                basilicaName={selectedBasilica.name}
                onClose={() => setShowVideo(false)}
            />
        )}

        {/* 360° 浮動全景視窗 */}
        {showPanorama && selectedBasilica?.panoramaId && (
            <ChurchPanoramaViewer
                panoramaId={selectedBasilica.panoramaId}
                basilicaName={selectedBasilica.name}
                onClose={() => setShowPanorama(false)}
                heading={selectedBasilica.panoramaHeading}
            />
        )}
        </View>
    );
}

const styles = StyleSheet.create({
    scrollRoot: {
        flex: 1,
    },
    container: {
        paddingHorizontal: 12,
        paddingVertical: 10,
        paddingBottom: 32,
    },
    headerSection: {
        marginTop: 8,
        marginBottom: 16,
        // 留出足夠空間讓漢堡選單按鈕（約 44px + hitSlop + margin ≈ 64px）不會遮住標題
        paddingLeft: 72,
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
        justifyContent: 'center',
        alignItems: 'center',
        marginBottom: 16,
        width: '100%',
    },
    map: {
        width: '90%',
        height: 300,
        borderRadius: 12,
    },
    searchCard: {
        marginBottom: 12,
        paddingHorizontal: 14,
        paddingVertical: 10,

        borderColor: "rgba(255,255,255,0.01)",
        borderWidth: 1,
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
    searchTextInput: {
        flex: 1,
        fontSize: 14,
        color: "rgba(255,255,255,0.95)",
        paddingVertical: 0,
    },
    clearButton: {
        padding: 4,
        marginLeft: 4,
        cursor: "pointer",
    },
    clearButtonText: {
        fontSize: 14,
        color: "rgba(255,255,255,0.6)",
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
        backgroundColor: "rgba(255,255,255,0.05)",
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
        marginBottom: 12,
    },
    listItem: {
        marginBottom: 10,
    },
    listItemActive: {},
    listItemCard: {
        paddingHorizontal: 12,
        paddingVertical: 10,
        borderColor: "rgba(255,255,255,0.01)",
        borderWidth: 1,
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
    viewMoreBtn: {
        alignItems: "center",
        paddingVertical: 12,
        marginTop: 4,
        backgroundColor: "rgba(255,255,255,0.05)",
        borderRadius: 10,
        borderWidth: 1,
        borderColor: "rgba(255,255,255,0.15)",
    },
    viewMoreBtnText: {
        fontSize: 14,
        fontWeight: "600",
        color: "rgba(255,255,255,0.8)",
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
    detailSection: {
        marginBottom: 12,
    },
    detailCard: {
        paddingHorizontal: 16,
        paddingVertical: 14,
        borderColor: "rgba(255,255,255,0.01)",
        borderWidth: 1,
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
        color: "rgba(255,255,255,0.7)",
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
        color: "rgba(255,255,255,0.8)",
        fontWeight: "600",
        marginBottom: 4,
    },
    detailValue: {
        fontSize: 14,
        color: "rgba(255,255,255,0.9)",
    },
    detailSection2: {
        marginTop: 14,
    },
    detailSectionTitle: {
        fontSize: 13,
        color: "rgba(255,255,255,0.85)",
        marginBottom: 6,
    },
    detailDescription: {
        fontSize: 12,
        color: "rgba(255,255,255,0.8)",
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
    loadingContainer: {
        flex: 1,
        justifyContent: "center",
        alignItems: "center",
    },
    loadingText: {
        fontSize: 18,
        color: "#FFFFFF",
    },
    errorContainer: {
        flex: 1,
        justifyContent: "center",
        alignItems: "center",
    },
    errorText: {
        fontSize: 16,
        color: "rgba(255,0,0,0.8)",
    },
    noPanoramaHint: {
        marginTop: 12,
        paddingVertical: 8,
        alignItems: "center",
        backgroundColor: "rgba(255,255,255,0.04)",
        borderRadius: 8,
        borderWidth: 1,
        borderColor: "rgba(255,255,255,0.08)",
    },
    noPanoramaText: {
        fontSize: 11,
        color: "rgba(255,255,255,0.4)",
    },
    videoBtn: {
        marginTop: 16,
        borderRadius: 14,
        overflow: "hidden",
        borderWidth: 1,
        borderColor: "rgba(220,80,60,0.6)",
        backgroundColor: "rgba(220,80,60,0.18)",
        cursor: "pointer",
    },
    videoBtnPressed: {
        backgroundColor: "rgba(220,80,60,0.38)",
        borderColor: "rgba(220,80,60,1)",
    },
    videoBtnInner: {
        flexDirection: "row",
        alignItems: "center",
        paddingHorizontal: 16,
        paddingVertical: 14,
        gap: 12,
    },
    videoBtnIcon: {
        fontSize: 28,
    },
    videoBtnLabel: {
        fontSize: 14,
        fontWeight: "700",
        color: "rgba(255,255,255,0.95)",
    },
    videoBtnSub: {
        fontSize: 11,
        color: "rgba(220,80,60,0.9)",
        marginTop: 2,
    },
    videoBtnArrow: {
        fontSize: 24,
        color: "rgba(220,80,60,0.8)",
        marginLeft: "auto",
    },
    panoramaBtn: {
        marginTop: 16,
        borderRadius: 14,
        overflow: "hidden",
        borderWidth: 1,
        borderColor: "rgba(102,126,234,0.6)",
        backgroundColor: "rgba(102,126,234,0.18)",
        cursor: "pointer",
    },
    panoramaBtnPressed: {
        backgroundColor: "rgba(102,126,234,0.38)",
        borderColor: "rgba(102,126,234,1)",
    },
    panoramaBtnInner: {
        flexDirection: "row",
        alignItems: "center",
        paddingHorizontal: 16,
        paddingVertical: 14,
        gap: 12,
    },
    panoramaBtnIcon: {
        fontSize: 28,
    },
    panoramaBtnLabel: {
        fontSize: 14,
        fontWeight: "700",
        color: "rgba(255,255,255,0.95)",
    },
    panoramaBtnSub: {
        fontSize: 11,
        color: "rgba(102,126,234,0.9)",
        marginTop: 2,
    },
    panoramaBtnArrow: {
        fontSize: 24,
        color: "rgba(102,126,234,0.8)",
        marginLeft: "auto",
    },
});