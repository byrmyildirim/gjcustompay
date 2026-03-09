import { json, type LoaderFunctionArgs, type ActionFunctionArgs } from "@remix-run/node";
import { useLoaderData, useNavigate, useFetcher } from "@remix-run/react";
import {
  Page,
  Layout,
  Text,
  Card,
  Button,
  BlockStack,
  Box,
  Badge,
  IndexTable,
  Banner,
  InlineStack,
  Icon,
  List,
} from "@shopify/polaris";
import {
  PlusIcon,
  SettingsIcon,
  DeleteIcon,
  EditIcon,
  CheckCircleIcon,
  AlertBubbleIcon
} from "@shopify/polaris-icons";
import { authenticate } from "../shopify.server";

export const loader = async ({ request }: LoaderFunctionArgs) => {
  const { admin } = await authenticate.admin(request);
  const response = await admin.graphql(
    `#graphql
    query GetCustomizations {
      paymentCustomizations(first: 20) {
        edges {
          node {
            id
            title
            enabled
            functionId
            metafield(namespace: "gj-custom-pay", key: "configuration") {
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
  const intent = formData.get("intent");
  const id = formData.get("id") as string;
  if (intent === "toggle") {
    const enabled = formData.get("enabled") === "true";
    await admin.graphql(
      `#graphql
      mutation UpdateCustomization($id: ID!, $enabled: Boolean!) {
        paymentCustomizationUpdate(id: $id, paymentCustomization: { enabled: $enabled }) {
          paymentCustomization { id }
          userErrors { message }
        }
      }`,
      { variables: { id, enabled } }
    );
  } else if (intent === "delete") {
    await admin.graphql(
      `#graphql
      mutation DeleteCustomization($id: ID!) {
        paymentCustomizationDelete(id: $id) {
          deletedId
          userErrors { message }
        }
      }`,
      { variables: { id } }
    );
  }
  return json({ success: true });
};

export default function Index() {
  const { customizations } = useLoaderData<typeof loader>();
  const navigate = useNavigate();
  const fetcher = useFetcher();

  const resourceName = {
    singular: "Ödeme Kuralı",
    plural: "Ödeme Kuralları",
  };

  const rowMarkup = customizations.map(
    ({ node }: any, index: number) => (
      <IndexTable.Row
        id={node.id}
        key={node.id}
        position={index}
      >
        <IndexTable.Cell>
          <Text variant="bodyMd" fontWeight="bold" as="span">
            {node.title}
          </Text>
        </IndexTable.Cell>
        <IndexTable.Cell>Gizleme (Hide)</IndexTable.Cell>
        <IndexTable.Cell>
          <Badge tone={node.enabled ? "success" : "info"}>
            {node.enabled ? "Aktif" : "Pasif"}
          </Badge>
        </IndexTable.Cell>
        <IndexTable.Cell>
          <InlineStack gap="200">
            <Button
              icon={EditIcon}
              onClick={() => navigate(`/app/configuration/${node.id.split("/").pop()}`)}
              variant="tertiary"
            />
            <Button
              icon={node.enabled ? AlertBubbleIcon : CheckCircleIcon}
              onClick={() => {
                const formData = new FormData();
                formData.append("intent", "toggle");
                formData.append("id", node.id);
                formData.append("enabled", String(!node.enabled));
                fetcher.submit(formData, { method: "POST" });
              }}
              variant="tertiary"
              tone={node.enabled ? "critical" : undefined}
            />
            <Button
              icon={DeleteIcon}
              onClick={() => {
                if (confirm("Bu kuralı silmek istediğinizden emin misiniz?")) {
                  const formData = new FormData();
                  formData.append("intent", "delete");
                  formData.append("id", node.id);
                  fetcher.submit(formData, { method: "POST" });
                }
              }}
              variant="tertiary"
              tone="critical"
            />
          </InlineStack>
        </IndexTable.Cell>
      </IndexTable.Row>
    ),
  );

  return (
    <Page fullWidth>
      <BlockStack gap="500">
        <Banner tone="warning">
          <p>Uygulama şu an test modundadır. Lütfen ayarların doğruluğundan emin olun.</p>
        </Banner>

        <Layout>
          <Layout.Section>
            <BlockStack gap="500">
              <Text as="h1" variant="headingLg">Dashboard</Text>

              <InlineStack gap="400" wrap={false}>
                <Box minWidth="30%">
                  <Card>
                    <BlockStack gap="200">
                      <Text as="h2" variant="headingSm">Aktif Özelleştirmeler</Text>
                      <Text as="p" variant="headingLg">
                        {customizations.filter((c: any) => c.node.enabled).length} / 5
                      </Text>
                      <Text as="p" variant="bodySm" tone="subdued">Aktif olan kural sayısı</Text>
                    </BlockStack>
                  </Card>
                </Box>
                <Box minWidth="30%">
                  <Card>
                    <BlockStack gap="200">
                      <Text as="h2" variant="headingSm">Yeni Kural Ekle</Text>
                      <Button
                        variant="plain"
                        onClick={() => navigate("/app/configuration/new")}
                      >
                        Yeni Ödeme Kuralı Oluştur
                      </Button>
                    </BlockStack>
                  </Card>
                </Box>
                <Box minWidth="30%">
                  <Card>
                    <BlockStack gap="200">
                      <Text as="h2" variant="headingSm">Kural İstatistikleri</Text>
                      <InlineStack gap="400">
                        <BlockStack>
                          <Text as="p" variant="bodySm">Gizleme</Text>
                          <Text as="p" variant="headingMd">{customizations.length}</Text>
                        </BlockStack>
                        <BlockStack>
                          <Text as="p" variant="bodySm">Sıralama</Text>
                          <Text as="p" variant="headingMd">0</Text>
                        </BlockStack>
                      </InlineStack>
                    </BlockStack>
                  </Card>
                </Box>
              </InlineStack>

              <Card padding="0">
                <IndexTable
                  resourceName={resourceName}
                  itemCount={customizations.length}
                  headings={[
                    { title: "Başlık" },
                    { title: "Kural Tipi" },
                    { title: "Durum" },
                    { title: "İşlem" },
                  ]}
                  selectable={false}
                >
                  {rowMarkup}
                </IndexTable>
                {customizations.length === 0 && (
                  <Box padding="1000">
                    <BlockStack gap="200" align="center">
                      <Text as="p" variant="bodyMd" tone="subdued">Henüz bir kural oluşturulmamış.</Text>
                      <Button onClick={() => navigate("/app/configuration")}>İlk Kuralı Ayarla</Button>
                    </BlockStack>
                  </Box>
                )}
              </Card>

              <Card>
                <BlockStack gap="300">
                  <Text as="h2" variant="headingMd">Sınırlamalar & Bilgiler</Text>
                  <List>
                    <List.Item>Ödeme Özelleştirme API'si şu an taslak siparişleri (draft orders) desteklememektedir.</List.Item>
                    <List.Item>Logosu olan ödeme yöntemlerini yeniden adlandıramazsınız.</List.Item>
                    <List.Item>Aynı anda en fazla 5 aktif ödeme özelleştirmesi kullanabilirsiniz.</List.Item>
                    <List.Item>Hızlı ödeme butonlarını (Express Checkout) bu uygulama gizleyemez, Shopify ayarlarından kapatılmalıdır.</List.Item>
                  </List>
                </BlockStack>
              </Card>
            </BlockStack>
          </Layout.Section>
        </Layout>
      </BlockStack>
    </Page>
  );
}
