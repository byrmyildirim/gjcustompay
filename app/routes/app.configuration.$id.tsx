import { useState, useCallback, useEffect } from "react";
import type { ActionFunctionArgs, LoaderFunctionArgs } from "@remix-run/node";
import { json, redirect } from "@remix-run/node";
import { useLoaderData, useFetcher, useNavigate, useParams } from "@remix-run/react";
import {
    Page,
    Layout,
    Text,
    Card,
    Button,
    BlockStack,
    TextField,
    Banner,
    PageActions,
} from "@shopify/polaris";
import { TitleBar, useAppBridge } from "@shopify/app-bridge-react";
import { authenticate } from "../shopify.server";

export const loader = async ({ request, params }: LoaderFunctionArgs) => {
    const { admin } = await authenticate.admin(request);
    const { id } = params;

    let customization = null;
    let functionId = null;

    // 1. Mevcut app installation üzerindeki function'ları sorgulayarak bu app'e ait function ID'yi bul
    try {
        const appResponse = await admin.graphql(
            `#graphql
            query GetAppFunctions {
                shopifyFunctions(first: 20) {
                    nodes {
                        id
                        title
                        apiType
                    }
                }
            }`
        );
        const appJson = (await appResponse.json()) as any;
        const functions = appJson.data?.shopifyFunctions?.nodes || [];
        console.log("Fetched app functions:", JSON.stringify(functions, null, 2));

        // Bu uygulamanın sahip olduğu payment-customization tipindeki ilk function'ı alalım
        const funcNode = functions.find((f: any) => f.apiType === "payment_customization");
        if (funcNode) {
            // Shopify Function ID usually needs the UUID part or the full GID depending on implementation
            // But paymentCustomizationCreate mutation expects the UUID for the 'functionId' field
            functionId = funcNode.id.split("/").pop();
        }
    } catch (e) {
        console.error("Could not fetch app functions:", e);
    }

    // 2. Eğer id "new" değilse, kural detaylarını getir
    if (id && id !== "new") {
        try {
            const response = await admin.graphql(
                `#graphql
                query GetCustomization($id: ID!) {
                    paymentCustomization(id: $id) {
                        id
                        title
                        enabled
                        functionId
                        metafield(namespace: "gj-custom-pay", key: "configuration") {
                            id
                            value
                        }
                    }
                }`,
                { variables: { id: `gid://shopify/PaymentCustomization/${id}` } }
            );
            const responseJson = await response.json();
            customization = responseJson.data?.paymentCustomization;
            if (customization?.functionId) {
                functionId = customization.functionId;
            }
        } catch (e) {
            console.error("Could not fetch customization details:", e);
        }
    }

    let existingConfig: {
        nutritionCollectionIds: string[];
        sportsCollectionIds: string[];
        paytrMethodName: string;
        iyzicoMethodName: string;
    } = {
        nutritionCollectionIds: [],
        sportsCollectionIds: [],
        paytrMethodName: "PayTR",
        iyzicoMethodName: "iyzico"
    };

    if (customization?.metafield?.value) {
        try {
            existingConfig = { ...existingConfig, ...JSON.parse(customization.metafield.value) };
        } catch (e) {
            console.error("Config parsing error", e);
        }
    }

    return json({ customization, existingConfig, functionId });
};

export const action = async ({ request, params }: ActionFunctionArgs) => {
    const { admin } = await authenticate.admin(request);
    const formData = await request.formData();
    const { id } = params;

    const title = formData.get("title") as string;
    const nutritionCollectionIds = JSON.parse(formData.get("nutritionCollectionIds") as string);
    const sportsCollectionIds = JSON.parse(formData.get("sportsCollectionIds") as string);
    const paytrMethodName = formData.get("paytrMethodName") as string;
    const iyzicoMethodName = formData.get("iyzicoMethodName") as string;
    const functionId = formData.get("functionId") as string;

    const configuration = JSON.stringify({
        nutritionCollectionIds,
        sportsCollectionIds,
        paytrMethodName,
        iyzicoMethodName,
    });

    try {
        if (id === "new") {
            const response = await admin.graphql(
                `#graphql
                mutation CreateCustomization($input: PaymentCustomizationInput!) {
                    paymentCustomizationCreate(paymentCustomization: $input) {
                        paymentCustomization {
                            id
                        }
                        userErrors {
                            field
                            message
                        }
                    }
                }`,
                {
                    variables: {
                        input: {
                            title,
                            functionId,
                            enabled: true,
                            metafield: {
                                namespace: "gj-custom-pay",
                                key: "configuration",
                                value: configuration,
                                type: "json"
                            }
                        }
                    }
                }
            );
            const result = (await response.json()) as any;
            
            if (result.errors) {
                console.error("GraphQL Errors:", JSON.stringify(result.errors, null, 2));
                return json({ errors: result.errors }, { status: 400 });
            }

            const newId = result.data?.paymentCustomizationCreate?.paymentCustomization?.id;
            if (newId) {
                return redirect(`/app`);
            }
            return json(result);
        } else {
            const fullId = `gid://shopify/PaymentCustomization/${id}`;
            const response = await admin.graphql(
                `#graphql
                mutation UpdateCustomization($id: ID!, $input: PaymentCustomizationInput!) {
                    paymentCustomizationUpdate(id: $id, paymentCustomization: $input) {
                        paymentCustomization {
                            id
                        }
                        userErrors {
                            field
                            message
                        }
                    }
                }`,
                {
                    variables: {
                        id: fullId,
                        input: {
                            title,
                            enabled: true,
                            metafield: {
                                namespace: "gj-custom-pay",
                                key: "configuration",
                                value: configuration,
                                type: "json"
                            }
                        }
                    }
                }
            );
            const result = (await response.json()) as any;
            if (result.errors) {
                console.error("GraphQL Errors:", JSON.stringify(result.errors, null, 2));
                return json({ errors: result.errors }, { status: 400 });
            }
            return json(result);
        }
    } catch (error: any) {
        console.error("Action error:", error);
        return json({ error: error.message }, { status: 500 });
    }
};

export default function ConfigurationEditPage() {
    const { customization, existingConfig, functionId } = useLoaderData<typeof loader>();
    const fetcher = useFetcher();
    const shopify = useAppBridge();
    const navigate = useNavigate();
    const params = useParams();

    const [title, setTitle] = useState(customization?.title || "Yeni Ödeme Kuralı");
    const [nutritionCollections, setNutritionCollections] = useState<any[]>(existingConfig.nutritionCollectionIds.map((id: string) => ({ id })));
    const [sportsCollections, setSportsCollections] = useState<any[]>(existingConfig.sportsCollectionIds.map((id: string) => ({ id })));
    const [paytrMethodName, setPaytrMethodName] = useState(existingConfig.paytrMethodName);
    const [iyzicoMethodName, setIyzicoMethodName] = useState(existingConfig.iyzicoMethodName);

    const selectNutrition = async () => {
        const selection = await shopify.resourcePicker({
            type: "collection",
            multiple: true,
            selectionIds: nutritionCollections.map(c => ({ id: c.id }))
        });
        if (selection) {
            setNutritionCollections(selection.map(c => ({ id: c.id, title: c.title })));
        }
    };

    const selectSports = async () => {
        const selection = await shopify.resourcePicker({
            type: "collection",
            multiple: true,
            selectionIds: sportsCollections.map(c => ({ id: c.id }))
        });
        if (selection) {
            setSportsCollections(selection.map(c => ({ id: c.id, title: c.title })));
        }
    };

    const handleSave = () => {
        fetcher.submit(
            {
                title,
                functionId: functionId || "",
                nutritionCollectionIds: JSON.stringify(nutritionCollections.map(c => c.id)),
                sportsCollectionIds: JSON.stringify(sportsCollections.map(c => c.id)),
                paytrMethodName,
                iyzicoMethodName,
            },
            { method: "POST" }
        );
    };

    useEffect(() => {
        if (fetcher.state === "idle" && fetcher.data && !(fetcher.data as any).userErrors) {
            shopify.toast.show("Kural başarıyla kaydedildi");
            if (params.id === "new") {
                navigate("/app");
            }
        }
    }, [fetcher.state, fetcher.data, navigate, params.id, shopify]);

    return (
        <Page
            backAction={{ content: "Dashboard", url: "/app" }}
            title={params.id === "new" ? "Yeni Kural Oluştur" : "Kuralı Düzenle"}
        >
            <Layout>
                <Layout.Section>
                    <Card>
                        <BlockStack gap="500">
                            <TextField
                                label="Kural Başlığı"
                                value={title}
                                onChange={setTitle}
                                helpText="Örn: Koleksiyon Bazlı Ödeme Kuralları"
                                autoComplete="off"
                            />

                            <Banner tone="info">
                                <Text as="p">
                                    Bu kural ile; <b>Beslenme</b> ürünleri için sadece <b>İyzico (Tek Çekim)</b>,
                                    <b>Spor</b> ürünleri için ise sadece <b>PayTR (Taksitli)</b> gösterilecektir.
                                    Karma sepetlerde <b>Tek Çekim</b> zorunlu tutulacaktır.
                                </Text>
                            </Banner>

                            <BlockStack gap="400">
                                <Card>
                                    <BlockStack gap="200">
                                        <Text as="h3" variant="headingSm">1. Grup: Beslenme / Tek Çekim</Text>
                                        <Text as="p" variant="bodyMd" tone="subdued">
                                            Bu koleksiyonlardan ürün sepetlendiğinde Taksitli (PayTR) ödeme gizlenir.
                                        </Text>
                                        <Button onClick={selectNutrition}>
                                            {nutritionCollections.length > 0 ? `${nutritionCollections.length} Koleksiyon Seçildi` : "Beslenme Koleksiyonlarını Seç"}
                                        </Button>
                                        {nutritionCollections.length > 0 && (
                                            <Text as="p" variant="bodySm" tone="success">
                                                Seçili: {nutritionCollections.map(c => c.title || c.id.split("/").pop()).join(", ")}
                                            </Text>
                                        )}
                                        <TextField
                                            label="İyzico (Tek Çekim) Metod Adı"
                                            value={iyzicoMethodName}
                                            onChange={setIyzicoMethodName}
                                            helpText="Ödeme adımında görünen tam adı veya bir kısmını yazın."
                                            autoComplete="off"
                                        />
                                    </BlockStack>
                                </Card>

                                <Card>
                                    <BlockStack gap="200">
                                        <Text as="h3" variant="headingSm">2. Grup: Spor / Taksitli</Text>
                                        <Text as="p" variant="bodyMd" tone="subdued">
                                            Bu koleksiyonlardan ürün sepetlendiğinde (ve beslenme yoksa) Tek Çekim (İyzico) gizlenir.
                                        </Text>
                                        <Button onClick={selectSports}>
                                            {sportsCollections.length > 0 ? `${sportsCollections.length} Koleksiyon Seçildi` : "Spor Koleksiyonlarını Seç"}
                                        </Button>
                                        {sportsCollections.length > 0 && (
                                            <Text as="p" variant="bodySm" tone="success">
                                                Seçili: {sportsCollections.map(c => c.title || c.id.split("/").pop()).join(", ")}
                                            </Text>
                                        )}
                                        <TextField
                                            label="PayTR (Taksitli) Metod Adı"
                                            value={paytrMethodName}
                                            onChange={setPaytrMethodName}
                                            helpText="Ödeme adımında görünen tam adı veya bir kısmını yazın."
                                            autoComplete="off"
                                        />
                                    </BlockStack>
                                </Card>
                            </BlockStack>
                        </BlockStack>
                    </Card>
                </Layout.Section>
                <Layout.Section>
                    <PageActions
                        primaryAction={{
                            content: "Ayarları ve Kuralları Kaydet",
                            onAction: handleSave,
                            loading: fetcher.state === "submitting"
                        }}
                    />
                </Layout.Section>
            </Layout>
        </Page>
    );
}
