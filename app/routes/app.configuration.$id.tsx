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
import { TitleBar, useAppBridge, ResourcePicker } from "@shopify/app-bridge-react";
import { authenticate } from "../shopify.server";

export const loader = async ({ request, params }: LoaderFunctionArgs) => {
    const { admin } = await authenticate.admin(request);
    const { id } = params;

    let customization = null;
    let functionId = null;

    // Tüm fonksiyon tanımlarını getir (yeni oluştururken lazım olacak)
    const functionResponse = await admin.graphql(
        `#graphql
        query GetFunctions {
            paymentCustomizationDefinitions(first: 10) {
                edges {
                    node {
                        id
                        functionId
                        title
                    }
                }
            }
        }`
    );
    const functionJson = await functionResponse.json();
    functionId = functionJson.data?.paymentCustomizationDefinitions?.edges?.[0]?.node?.functionId;

    if (id && id !== "new") {
        const response = await admin.graphql(
            `#graphql
            query GetCustomization($id: ID!) {
                paymentCustomization(id: $id) {
                    id
                    title
                    enabled
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
    }

    let existingConfig = {
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
        const result = await response.json();
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
        return json(await response.json());
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
                                helpText="Örn: Beslenme Kısıtlaması"
                                autoComplete="off"
                            />

                            <BlockStack gap="200">
                                <Text as="p" variant="bodyMd">
                                    <b>Beslenme Koleksiyonları:</b> (Sadece Tek Çekim uygulanacaklar)
                                </Text>
                                <Button onClick={selectNutrition}>
                                    {nutritionCollections.length > 0 ? `${nutritionCollections.length} Koleksiyon Seçildi` : "Koleksiyon Seç"}
                                </Button>
                                {nutritionCollections.length > 0 && (
                                    <Text as="p" variant="bodySm" tone="subdued">
                                        Seçili ID'ler: {nutritionCollections.map(c => c.id.split("/").pop()).join(", ")}
                                    </Text>
                                )}
                            </BlockStack>

                            <BlockStack gap="200">
                                <Text as="p" variant="bodyMd">
                                    <b>Spor Koleksiyonları:</b> (Taksitli uygulanabilecekler)
                                </Text>
                                <Button onClick={selectSports}>
                                    {sportsCollections.length > 0 ? `${sportsCollections.length} Koleksiyon Seçildi` : "Koleksiyon Seç"}
                                </Button>
                                {sportsCollections.length > 0 && (
                                    <Text as="p" variant="bodySm" tone="subdued">
                                        Seçili ID'ler: {sportsCollections.map(c => c.id.split("/").pop()).join(", ")}
                                    </Text>
                                )}
                            </BlockStack>

                            <TextField
                                label="PayTR Ödeme Yöntemi Adı (Taksitli)"
                                value={paytrMethodName}
                                onChange={setPaytrMethodName}
                                autoComplete="off"
                            />

                            <TextField
                                label="İyzico Ödeme Yöntemi Adı (Tek Çekim)"
                                value={iyzicoMethodName}
                                onChange={setIyzicoMethodName}
                                autoComplete="off"
                            />
                        </BlockStack>
                    </Card>
                </Layout.Section>
                <Layout.Section>
                    <PageActions
                        primaryAction={{
                            content: "Kuralı Kaydet",
                            onAction: handleSave,
                            loading: fetcher.state === "submitting"
                        }}
                    />
                </Layout.Section>
            </Layout>
        </Page>
    );
}
