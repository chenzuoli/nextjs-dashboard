"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import postgres from "postgres";
const sql = postgres(process.env.POSTGRES_URL!, { ssl: 'require' });


const FormSchema = z.object({
    id: z.string(),
    customerId: z.string({
        invalid_type_error: "Please select a customer.",
    }),
    amount: z.coerce.number().gt(0, "Amount must be greater than 0."),
    status: z.enum(["pending", "paid"], {
        invalid_type_error: "Please select a status.",
    }),
    date: z.string(),
});

const CreateInvoice = FormSchema.omit({ id: true , date: true })
const UpdateInvoice = FormSchema.omit({ id: true , date: true })

export type State = {
    errors?: {
        customer_id?: string[],
        amount?: string[],
        status?: string[],
    },
    message?: string | null;
}

export async function createInvoice(preState: State, formData: FormData) {
    const validatedFields = CreateInvoice.safeParse({
        customerId: formData.get("customerId"),
        amount: formData.get("amount"),
        status: formData.get("status"),
    });
    if (!validatedFields.success) {
        return {
            errors: validatedFields.error.flatten().fieldErrors,
            message: "Missing fields, Failed to create invoice",
        };
    }
    const { customerId, amount, status } = validatedFields.data;
    const amountInCents = amount * 100;
    const date = new Date().toISOString().split("T")[0];

    try {
        await sql`
        insert into invoices (customer_id, amount, status, date)
        values (${customerId}, ${amountInCents}, ${status}, ${date})
        `;
    } catch (error) {
        console.error("Database Error:", error);
        return {
            message: "Database error, Failed to create invoice.",
        }
    }

    revalidatePath("/dashboard/invoices");
    redirect("/dashboard/invoices");
}

export async function updateInvoice(id: string, preState: State, formData: FormData) {
    const validatedFields = UpdateInvoice.safeParse({
        customerId: formData.get("customerId"),
        amount: formData.get("amount"),
        status: formData.get("status"),
    });
    if (!validatedFields.success) {
        return {
            errors: validatedFields.error.flatten().fieldErrors,
            message: "Invalid form data.",
        }
    }

    const { customerId, amount, status } = validatedFields.data;
    const amountInCents = amount * 100;

    try {
        await sql`
        update invoices
        set customer_id = ${customerId}, amount = ${amountInCents}, status = ${status}
        where id = ${id}
        `;
    } catch (error) {
        console.error("Database Error:", error);
    }

    revalidatePath(`/dashboard/invoices`);
    redirect(`/dashboard/invoices`);
}

export async function deleteInvoice(id: string) {
    throw new Error("Failed to delete invoice.");

    await sql`
        delete from invoices
        where id = ${id}
    `;

    revalidatePath(`/dashboard/invoices`);
    // redirect(`/dashboard/invoices`);
}