import {
    RunInput,
    FunctionRunResult,
} from "../generated/api";

const NO_CHANGES: FunctionRunResult = {
    operations: [],
};

export function run(input: RunInput): FunctionRunResult {
    // Metafield'dan konfigürasyonu oku
    const configuration = JSON.parse(
        input.paymentCustomization?.metafield?.value ?? "{}"
    );

    const nutritionCollectionIds = configuration.nutritionCollectionIds || [];
    const sportsCollectionIds = configuration.sportsCollectionIds || [];
    const iyzicoMethodName = configuration.iyzicoMethodName || "iyzico";
    const paytrMethodName = configuration.paytrMethodName || "PayTR";

    let hasNutrition = false;
    let hasSports = false;

    for (const line of input.cart.lines) {
        if (line.merchandise.__typename === "ProductVariant") {
            const productCollections = (line.merchandise.product.collections.edges || []).map(
                (edge: any) => edge.node.id
            );

            if (productCollections.some((id: string) => nutritionCollectionIds.includes(id))) {
                hasNutrition = true;
            }
            if (productCollections.some((id: string) => sportsCollectionIds.includes(id))) {
                hasSports = true;
            }
        }
    }

    const operations = [];

    // Rule 1 & 3: Eğer sepette Beslenme ürünü varsa (tek başına veya sporla karma), 
    // PayTR (Taksitli) gizlenmeli, sadece tek çekim (İyzico) kalmalı.
    if (hasNutrition) {
        const paytrMethods = input.paymentMethods.filter((method) =>
            method.name.toLowerCase().includes(paytrMethodName.toLowerCase())
        );

        for (const method of paytrMethods) {
            operations.push({
                hide: {
                    paymentMethodId: method.id,
                },
            });
        }
    }
    // Rule 2: Eğer SADECE spor ürünleri varsa, PayTR (Taksitli) aktif olmalı.
    // Kullanıcının isteğine göre bu durumda İyzico'yu gizleyebiliriz.
    else if (hasSports) {
        const iyzicoMethods = input.paymentMethods.filter((method) =>
            method.name.toLowerCase().includes(iyzicoMethodName.toLowerCase())
        );

        for (const method of iyzicoMethods) {
            operations.push({
                hide: {
                    paymentMethodId: method.id,
                },
            });
        }
    }

    return {
        operations,
    };
}
