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

    return json({ customizations });
};

export const action = async ({ request }: ActionFunctionArgs) => {
    const { admin } = await authenticate.admin(request);
    const formData = await request.formData();

    const customizationId = formData.get("customizationId") as string;
    const collectionId = formData.get("collectionId") as string;
    const paymentMethodName = formData.get("paymentMethodName") as string;

    const configuration = JSON.stringify({
        collectionId,
        paymentMethodName,
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
    const { customizations } = useLoaderData<typeof loader>();
    const fetcher = useFetcher();
    const shopify = useAppBridge();

    const [selectedCollection, setSelectedCollection] = useState<{ id: string, title: string } | null>(null);
    const [paymentMethodName, setPaymentMethodName] = useState("");

    const firstCustomization = customizations[0]?.node;

    const selectCollection = async () => {
        const selection = await shopify.resourcePicker({
            type: "collection",
            multiple: false,
        });

        if (selection) {
            const collection = selection[0];
            setSelectedCollection({ id: collection.id, title: collection.title });
        }
    };

    const handleSave = () => {
        if (!firstCustomization) return;

        fetcher.submit(
            {
                customizationId: firstCustomization.id,
                collectionId: selectedCollection?.id || "",
                paymentMethodName: paymentMethodName,
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
                                    Kural Ayarları
                                </Text>

                                <BlockStack gap="200">
                                    <Text as="p" variant="bodyMd">
                                        Hangi koleksiyondaki ürünler sepetteyken kısıtlama uygulanacak?
                                    </Text>
                                    <Button onClick={selectCollection}>
                                        {selectedCollection ? `Seçili: ${selectedCollection.title}` : "Koleksiyon Seç"}
                                    </Button>
                                </BlockStack>

                                <TextField
                                    label="Gizlenecek Ödeme Yöntemi Adı"
                                    value={paymentMethodName}
                                    onChange={setPaymentMethodName}
                                    helpText="Örn: 'PayTR - Taksitli'. Bu metni içeren ödeme yöntemleri gizlenecektir."
                                    autoComplete="off"
                                />

                                <Button variant="primary" onClick={handleSave} loading={fetcher.state === "submitting"}>
                                    Ayarları Kaydet
                                </Button>
                            </BlockStack>
                        </Card>
                    )}
                </Layout.Section>
            </Layout>
        </Page>
    );
}
