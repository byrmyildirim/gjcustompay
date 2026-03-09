import { useState, useCallback } from "react";
import type { ActionFunctionArgs, LoaderFunctionArgs } from "@remix-run/node";
import { json } from "@remix-run/node";
import { useLoaderData, useFetcher } from "@remix-run/react";
import {
    Page,
    Layout,
    Text,
    Card,
    Button,
    BlockStack,
    TextField,
    Banner,
} from "@shopify/polaris";
import { TitleBar, useAppBridge, ResourcePicker } from "@shopify/app-bridge-react";
import { authenticate } from "../shopify.server";

export const loader = async ({ request }: LoaderFunctionArgs) => {
    const { admin } = await authenticate.admin(request);

    // Mevcut Payment Customization'ları ve metafield'larını getir
    const response = await admin.graphql(
        `#graphql
    query GetCustomizations {
      paymentCustomizations(first: 10) {
        edges {
          node {
            id
            title
            enabled
            metafield(namespace: "gj-custom-pay", key: "configuration") {
              id
              value
            }
          }
        }
      }
    }`
    );

    const responseJson = await response.json();
    const customizations = responseJson.data?.paymentCustomizations?.edges || [];

    let existingConfig = {
        nutritionCollectionIds: [],
        sportsCollectionIds: [],
        paytrMethodName: "PayTR",
        iyzicoMethodName: "iyzico"
    };

    if (customizations[0]?.node?.metafield?.value) {
        try {
            existingConfig = { ...existingConfig, ...JSON.parse(customizations[0].node.metafield.value) };
        } catch (e) {
            console.error("Config parsing error", e);
        }
    }

    return json({ customizations, existingConfig });
};

export const action = async ({ request }: ActionFunctionArgs) => {
    const { admin } = await authenticate.admin(request);
    const formData = await request.formData();

    const customizationId = formData.get("customizationId") as string;
    const nutritionCollectionIds = JSON.parse(formData.get("nutritionCollectionIds") as string);
    const sportsCollectionIds = JSON.parse(formData.get("sportsCollectionIds") as string);
    const paytrMethodName = formData.get("paytrMethodName") as string;
    const iyzicoMethodName = formData.get("iyzicoMethodName") as string;

    const configuration = JSON.stringify({
        nutritionCollectionIds,
        sportsCollectionIds,
        paytrMethodName,
        iyzicoMethodName,
    });

    // Metafield güncelleme veya oluşturma
    const response = await admin.graphql(
        `#graphql
    mutation UpdateMetafield($customizationId: ID!) {
      paymentCustomizationUpdate(id: $customizationId, paymentCustomization: {
        metafield: {
          namespace: "gj-custom-pay",
          key: "configuration",
          value: "${configuration.replace(/"/g, '\\"')}",
          type: "json"
        }
      }) {
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
                customizationId
            }
        }
    );

    return json(await response.json());
};

export default function ConfigurationPage() {
    const { customizations, existingConfig } = useLoaderData<typeof loader>();
    const fetcher = useFetcher();
    const shopify = useAppBridge();

    const [nutritionCollections, setNutritionCollections] = useState<any[]>(existingConfig.nutritionCollectionIds.map(id => ({ id })));
    const [sportsCollections, setSportsCollections] = useState<any[]>(existingConfig.sportsCollectionIds.map(id => ({ id })));
    const [paytrMethodName, setPaytrMethodName] = useState(existingConfig.paytrMethodName);
    const [iyzicoMethodName, setIyzicoMethodName] = useState(existingConfig.iyzicoMethodName);

    const firstCustomization = customizations[0]?.node;

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
        if (!firstCustomization) return;

        fetcher.submit(
            {
                customizationId: firstCustomization.id,
                nutritionCollectionIds: JSON.stringify(nutritionCollections.map(c => c.id)),
                sportsCollectionIds: JSON.stringify(sportsCollections.map(c => c.id)),
                paytrMethodName,
                iyzicoMethodName,
            },
            { method: "POST" }
        );
    };

    return (
        <Page>
            <TitleBar title="Ödeme Kısıtlama Ayarları" />
            <Layout>
                <Layout.Section>
                    {!firstCustomization ? (
                        <Banner tone="warning">
                            Lütfen önce Shopify panelinden bir "Payment Customization" uzantısı oluşturun.
                        </Banner>
                    ) : (
                        <Card>
                            <BlockStack gap="500">
                                <Text as="h2" variant="headingMd">
                                    Kategori Bazlı Ödeme Kuralları
                                </Text>

                                <BlockStack gap="200">
                                    <Text as="p" variant="bodyMd">
                                        <b>Beslenme Koleksiyonları:</b> (Sadece Tek Çekim uygulanacak kategoriler)
                                    </Text>
                                    <Button onClick={selectNutrition}>
                                        {nutritionCollections.length > 0 ? `${nutritionCollections.length} Koleksiyon Seçildi` : "Beslenme Koleksiyonlarını Seç"}
                                    </Button>
                                    {nutritionCollections.length > 0 && (
                                        <Text as="p" variant="bodySm" tone="subdued">
                                            {nutritionCollections.map(c => c.title || c.id).join(", ")}
                                        </Text>
                                    )}
                                </BlockStack>

                                <BlockStack gap="200">
                                    <Text as="p" variant="bodyMd">
                                        <b>Spor Koleksiyonları:</b> (Bisiklet, Koşu, Yüzme vb. Taksitli uygulanacaklar)
                                    </Text>
                                    <Button onClick={selectSports}>
                                        {sportsCollections.length > 0 ? `${sportsCollections.length} Koleksiyon Seçildi` : "Spor Koleksiyonlarını Seç"}
                                    </Button>
                                    {sportsCollections.length > 0 && (
                                        <Text as="p" variant="bodySm" tone="subdued">
                                            {sportsCollections.map(c => c.title || c.id).join(", ")}
                                        </Text>
                                    )}
                                </BlockStack>

                                <TextField
                                    label="PayTR Ödeme Yöntemi Adı (Taksitli)"
                                    value={paytrMethodName}
                                    onChange={setPaytrMethodName}
                                    helpText="Bu ismi içeren yöntemler Beslenme ürünleri sepetteyken gizlenir."
                                    autoComplete="off"
                                />

                                <TextField
                                    label="İyzico Ödeme Yöntemi Adı (Tek Çekim)"
                                    value={iyzicoMethodName}
                                    onChange={setIyzicoMethodName}
                                    helpText="Sadece spor ürünleri varken (Beslenme yokken) bu yöntem gizlenir."
                                    autoComplete="off"
                                />

                                <Button variant="primary" onClick={handleSave} loading={fetcher.state === "submitting"}>
                                    Ayarları Kaydet
                                </Button>

                                {(fetcher.data as any)?.data?.paymentCustomizationUpdate?.userErrors?.length > 0 && (
                                    <Banner tone="critical">
                                        {(fetcher.data as any).data.paymentCustomizationUpdate.userErrors[0].message}
                                    </Banner>
                                )}
                                {fetcher.state === "idle" && (fetcher.data as any)?.data?.paymentCustomizationUpdate?.paymentCustomization && (
                                    <Banner tone="success">Ayarlar başarıyla kaydedildi.</Banner>
                                )}
                            </BlockStack>
                        </Card>
                    )}
                </Layout.Section>
            </Layout>
        </Page>
    );
}
