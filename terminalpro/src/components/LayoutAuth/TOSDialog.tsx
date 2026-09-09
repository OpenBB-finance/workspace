import { useCallback } from "react";
import { toast } from "sonner";
import { useIntersectionObserver } from "usehooks-ts";
import { acceptTerms } from "~/api/auth.api";
import { getConfig } from "~/lib/runtimeConfig";
import { useAuthStore } from "~/lib/state/auth";
import { useShallowFeatureFlagsStore } from "~/lib/state/featureFlags";
import { cn } from "~/lib/utils";
import { BaseDialog } from "../ds/dialogs/BaseDialog";
import { DialogTitle } from "../ds/dialogs/Dialog";

const uiShowTOSFF = getConfig().ui.showTos;

export default function TOSDialog() {
  const { tosAccepted, updateTosAccepted, user } = useAuthStore();
  const { featureFlags } = useShallowFeatureFlagsStore((state) => ({
    featureFlags: state.featureFlags,
  }));

  const { ref: lastElementRef, isIntersecting: isScrolled } = useIntersectionObserver({
    threshold: 1,
  });

  const acceptTOS = useCallback(async () => {
    const errorMsg = "Couldn't accept terms and conditions, please try again later.";
    try {
      const res = await acceptTerms();
      if (res.success) {
        updateTosAccepted(true);
      } else {
        toast.error(errorMsg);
      }
    } catch (_error) {
      toast.error(errorMsg);
    }
  }, [updateTosAccepted]);

  return (
    <BaseDialog
      open={uiShowTOSFF && !tosAccepted && featureFlags?.tier === "pro"}
      className="[&>.DialogXButton]:hidden h-[60vh]"
    >
      <DialogTitle>Terms and Conditions</DialogTitle>

      {user?.entity_name !== "OpenBB Trial" && (
        <p className="text-red-600">
          We've updated our Terms and Conditions - Please review and agree below.
        </p>
      )}

      <TOSDialogContent lastElementRef={lastElementRef} />

      <button
        aria-label="tos-accept-button"
        className="self-end obb-btn-blue"
        disabled={!isScrolled}
        onClick={acceptTOS}
      >
        I agree to the terms and conditions
      </button>
    </BaseDialog>
  );
}

export function TOSDialogContent({
  className,
  lastElementRef,
}: {
  className?: string;
  lastElementRef: (node: HTMLParagraphElement | null) => void;
}) {
  return (
    <div
      className={cn(
        "dark:bg-[#212126] dark:text-light-400 px-3 py-2 max-h-full rounded dark:border-[#303038] border my-4 overflow-auto space-y-2",
        "bg-light-50 text-light-800 border-[#e2e8f0]",
        className,
      )}
    >
      <p>
        These OpenBB Pro Terms and Conditions (the “Agreement”) sets forth the terms and
        conditions between Customer (as defined in the paragraph below) and OpenBB,
        Inc., a Delaware corporation with mailing address 7726 Gunston Plz PO Box 194,
        Lorton VA 22199 (“OpenBB”) which govern Customer’s access and use of the
        Services. OpenBB and Customer may be referred to herein collectively as the
        “Parties” or individually as a “Party.” By signing an Order Form, accessing or
        using the Services, or clicking a box indicating your acceptance of this
        Agreement, you are creating a legally binding and enforceable contract where
        you, and if you plan to use the Services for, on behalf of, or in connection
        with any entity or if you indicate any entity on the applicable Order Form (the
        “Entity”), together with the Entity (collectively, “Customer”), agree to be
        bound by all the terms and conditions of this Agreement. You represent and
        warrant that you are lawfully able to enter into contracts on behalf of the
        Customer and that you have legal authority to bind the Customer. If you do not
        have the authority to act on behalf the Customer, or you do not, or Customer
        does not, agree to all the terms and conditions of this Agreement, you and the
        Customer are prohibited from using the Services. If these terms and conditions
        of this Agreement are considered an offer, acceptance is expressly limited to
        these terms.
      </p>
      <h2 id="definitions">1. Definitions</h2>
      <ol type="a">
        <li>
          <p>
            <strong>“Authorized Users”</strong> means Customer’s employees, consultants,
            contractors, and agents, in each case, who have been authorized by Customer
            to access and use the Services for or on behalf of the Customer under the
            rights granted to Customer pursuant to this Agreement, and for whom access
            to the Services has been purchased hereunder. If no Entity is indicated on
            the applicable Order form, Authorized User means the Customer.
          </p>
        </li>
        <li>
          <p>
            <strong>“Customer Input”</strong> means information, data, and other content
            that an Authorized User submits or inputs into the Services in order to be
            processed by the Services, including prompts used to instruct the Services.
          </p>
        </li>
        <li>
          <p>
            <strong>“Customer Output”</strong> means the output generated and returned
            by the Services to Authorized Users in response to the Customer Input.
          </p>
        </li>
        <li>
          <p>
            <strong>“Customer IP”</strong> means Customer Inputs and Customer Outputs.
          </p>
        </li>
        <li>
          <p>
            <strong>“Documentation”</strong> means OpenBB’s user manuals and guides
            relating to the Services that OpenBB makes available to Customer.
          </p>
        </li>
        <li>
          <p>
            <strong>“OpenBB IP”</strong> means the Services, the Documentation, and any
            and all intellectual property related thereto, including the underlying
            infrastructures, systems, algorithms, source code, datasets, and any
            modifications, changes, or derivative works based on or related to any of
            the foregoing. For the avoidance of doubt, OpenBB IP does not include
            Customer IP.
          </p>
        </li>
        <li>
          <p>
            <strong>“Order Form”</strong> means any ordering document for the Services
            that is mutually executed by the Parties that reference to this Agreement or
            is signed by Customer on OpenBB website that Customer uses to purchase the
            Services.
          </p>
        </li>
        <li>
          <p>
            <strong>“Prohibited Data”</strong> means (a) protected health information or
            personal health data (e.g. medical records or an individual’s health care
            claim information), (b) non-public, government-issued ID numbers
            (e.g. driver’s license numbers, Social Security Numbers), (c) personal
            financial data or financial account numbers (e.g. account numbers for a
            personal debit card or credit card), (d) any personal information of
            children under 16 or the applicable age of digital consent), (e) any other
            data that (i) is classified as “sensitive,” “special category” or a similar
            categorization under applicable data protection laws (e.g. the General Data
            Protection Regulation, the Health Insurance Portability and Accountability
            Act, Gramm-Leach-Bliley Act, or the Payment Card Industry Data Security
            Standards); (ii) constitutes criminal convictions data, or criminal offense
            data; or (iii) for which there is no consent from the applicable data
            subject for it to be submitted to OpenBB or processed through the Services.
          </p>
        </li>
        <li>
          <p>
            <strong>“Services”</strong> means OpenBB Workspace, available at{" "}
            <a href="https://pro.openbb.co">pro.openbb.co</a>.
          </p>
        </li>
      </ol>
      <h2 id="access-and-use">2. Access and Use</h2>
      <ol type="a">
        <li>
          <p>
            Ordering Process. Any order submitted by Customer shall be subject to
            OpenBB’s acceptance, in its sole discretion, in writing. Each Order Form,
            once mutually executed by the Parties, shall be incorporated into and
            subject to the terms of this Agreement. Any additional or conflicting terms
            or conditions in any Order Form shall be of no force or effect, unless the
            Order Form and the additional or conflicting terms expressly modify this
            Agreement by referencing the corresponding sections of this Agreement, in
            which event such modification shall prevail only with respect to the Order
            Form in which the modification is set forth. An Order Form may be executed
            in counterparts, each of which is deemed an original, but all of which
            together are deemed to be one and the same agreement.
          </p>
        </li>
        <li>
          <p>
            Provision of Access. Subject to Customer’s full compliance with all terms
            and conditions of this Agreement, OpenBB hereby grants Customer a limited,
            non-exclusive, non-transferable, and non-sublicensable license, during the
            period set forth in the applicable Order Form unless earlier terminated in
            accordance with this Agreement or such Order Form (the “Services Term”), to
            access and use the Services solely by Authorized Users, subject to the
            maximum number of users and rate limit set forth in the applicable Order
            Form and pursuant to the user documentation made available by OpenBB. OpenBB
            may in its sole discretion modify, enhance or otherwise change the Services,
            provided that such changes do not materially limit or adversely affect the
            Services provided to Customer hereunder.
          </p>
        </li>
        <li>
          <p>
            Use Restrictions. Customer shall not, directly or indirectly: (i) reverse
            engineer, disassemble, decompile, decode, adapt, or otherwise attempt to
            derive or gain access to or attempt to discover the source code, object code
            or underlying structure, ideas or algorithms of the Services or any
            software, systems, Artificial Intelligence or Machine Learning models,
            Documentation, Customer Outputs, or data related to the Services
            (“Software”) (provided that reverse engineering is prohibited only to the
            extent such prohibition is not contrary to applicable law); (ii) copy,
            modify, translate, or create derivative works of the Services or Software,
            in whole or in part; (iii) use or access the Services or Software for
            timesharing or service bureau purposes or for any purpose other than for the
            internal benefit of Customer as set forth in this Agreement; (iv) rent,
            lease, lend, sell, resell, license, sublicense, assign, distribute, publish,
            transfer, or otherwise make available the Services, Software, or Customer
            Outputs; (v) remove any product identification, proprietary, copyright or
            other notices from the Services or Software, except as expressly and
            specifically authorized by OpenBB under a specific Order Form on a case by
            case basis; (vi) use the Services or any Customer Output to develop or train
            a language model or any other machine learning model, or create databases,
            data brokerage, data selling/reselling businesses, or related products or
            services, whether competitive with the Services or not (all of the foregoing
            collectively, the “AI and Data Selling Services”); (vii) use or permit the
            use of any tools in order to probe, scan or attempt to penetrate the
            Services, or engage in model extraction or stealing attacks;; (viii) create
            or provide to any third party the results of any benchmark tests or other
            evaluation of the Services without OpenBB’s prior written consent; (ix) use
            any method (whether through use of manual or automated means) to harvest,
            scrape, or extract data from the Services, other than as permitted through
            application programming interfaces (APIs) offered by OpenBB as part of the
            Services; (x) copy, cache, or store either (1) any Customer Output for the
            purpose of providing such Customer Output to any third party (other than to
            the Authorized User who submitted the corresponding prompt that instructed
            the Services to generate such Customer Output), or (2) any significant
            portion of, or create a database of, any Customer Output, other than for use
            with the OpenBB Services as explicitly authorized hereunder, (xi)
            intentionally or knowingly use or otherwise cause the Services to generate
            or develop infringing or illegal content; (xii) use the Services or Software
            in any manner or for any purpose that infringes, misappropriates, or
            otherwise violates any intellectual property right or other right of any
            person, or that violates any applicable laws or regulations (including but
            not limited to any privacy laws, and laws or regulations concerning
            intellectual property, consumer and child protection, obscenity or
            defamation); (xiii) intentionally or knowingly diverge requests of
            Authorized Users away from the Services (such as by making available
            Customer Outputs from previous prompts for future uses, or incorporating
            Customer Outputs into an AI and Data Selling Services; or (xiv) permit any
            Authorized User or third party to do any of the foregoing. Customer will use
            reasonable efforts to prevent any unauthorized use of the Services or the
            Software, and will promptly notify OpenBB of any unauthorized use that comes
            to Customer’s attention and provide all reasonable cooperation to prevent
            and terminate such use.
          </p>
        </li>
      </ol>
      <h2 id="service-levels-support">3. Service Levels; Support</h2>
      <ol type="a">
        <li>
          <p>
            Service Levels. Subject to the terms and conditions of this Agreement,
            OpenBB shall use commercially reasonable efforts to make the Services
            available twenty-four (24) hours a day, seven (7) days a week.
          </p>
        </li>
        <li>
          <p>
            Support. Subject to the terms and conditions of this Agreement, OpenBB will
            provide Customer with the standard support and maintenance services that
            OpenBB generally provides to its customers without additional charge from
            Monday through Friday during OpenBB’s normal business hours.
          </p>
        </li>
      </ol>
      <h2 id="intellectual-property-rights-and-data">
        4. Intellectual Property Rights and Data
      </h2>
      <ol type="a">
        <li>
          <p>
            OpenBB IP. As between the Parties, OpenBB retains all right, title and
            interest in and to the OpenBB IP, except for the limited license granted to
            Customer to access and use the Services in Section 2(b).
          </p>
        </li>
        <li>
          <p>
            Customer IP. As between the Parties, Customer retains all right, title and
            interest in and to the Customer IP, except for the license granted to OpenBB
            in this Section 4(b). Customer agrees that, each Customer Output shall be
            primarily for the exclusive use of the Authorized User who submitted the
            corresponding prompt that instructed the Services to generate such Customer
            Output, and shall not be copied, cached, stored, or made available to third
            parties in connection with any AI and Data Selling Services. Customer grants
            OpenBB a nonexclusive, worldwide, royalty-free, perpetual, sublicensable
            license to use, copy, reproduce, distribute, and make derivative works of
            Customer IP for the purpose of providing the Services to Customer and
            performing under this Agreement. OpenBB will not use Customer IP to train
            any machine learning models.
          </p>
        </li>
        <li>
          <p>
            Usage Data. OpenBB shall have the right to collect and analyze data and
            other information relating to the provision, use and performance of various
            aspects of the Services and related systems and technologies (including,
            without limitation, metadata, technical, usage, and diagnostic related
            information about Customer’s use of the Services, collectively, “Usage
            Data”), and OpenBB will be free (during and after the term hereof) to (i)
            use the Usage Data to improve and enhance the Services and for other
            development, diagnostic and corrective purposes in connection with the
            Services and other OpenBB offerings, and (ii) disclose the Usage data solely
            in aggregated or other de-identified form in connection with its business.
          </p>
        </li>
        <li>
          <p>
            Data Protection. OpenBB will maintain commercially reasonable
            administrative, physical and technical safeguards for the Services designed
            to protect against accidental or unauthorized access, use, alteration or
            disclosure of Customer IP properly uploaded to the Services and processed or
            stored on a server and/or computer network owned or controlled by OpenBB for
            the Services. Customer shall provide legally adequate privacy notices and
            obtain necessary consents for the processing of Personal Data by the
            Services, and shall process Personal Data in accordance with all applicable
            laws. Customer shall not, and shall not permit any third party (including
            Authorized Users) to, submit to or store in Services any Prohibited Data,
            except for storage and processing for which Customer has obtained adequate
            consent from all applicable data subjects.
          </p>
        </li>
        <li>
          <p>
            Reservation of Rights. Except for the limited rights and licenses expressly
            granted under this Agreement, nothing in this Agreement grants, by
            implication, waiver, estoppel, or otherwise, to Customer or any third party
            any intellectual property rights or other right, title, or interest in or to
            the OpenBB IP.
          </p>
        </li>
      </ol>
      <h2 id="customer-responsibilities">5. Customer Responsibilities</h2>
      <ol type="a">
        <li>
          <p>
            General. Customer is solely responsible and liable for all uses of the
            Services and Customer Outputs, including all acts and omissions of
            Authorized Users. Customer shall bind all Authorized Users to this
            Agreement’s provisions as applicable to such Authorized User’s use of the
            Services, and shall cause Authorized Users to comply with such provisions.
          </p>
        </li>
        <li>
          <p>
            Customer IP. Customer is solely responsible for the accuracy, completeness,
            quality and legality of the Customer Inputs (including complying with all
            applicable laws, rules or regulations and having all rights and permissions
            required to submit Customer Inputs to the Services). Customer acknowledges
            and agrees that Customer Outputs are generated through machine learning
            processes and are not tested, verified, endorsed or guaranteed to be
            accurate, complete or current by OpenBB. Customer and Authorized Users
            should independently review and verify all Customer Outputs as to the
            appropriateness for their use cases or applications. OpenBB is not
            responsible for verifying the accuracy or completeness of any Customer IP
            and is also not responsible for any inaccuracies or other errors in the
            Customer Outputs resulting from any errors in the Customer Inputs. Customer
            shall indemnify, hold harmless, and, at OpenBB’s option, defend OpenBB from
            and against any liabilities, damages, costs (including reasonable attorneys’
            fees) resulting from any third-party claim, suit, action, or proceeding
            related to (i) Customer Input, (ii) Customer’s use of the Services is not
            strictly in accordance with this Agreement and all related documentation, or
            (iii) otherwise from Customer’s or any Authorized User’s gross negligence or
            willful misconduct or use of the Services in a manner not authorized by this
            Agreement, provided that Customer may not settle any such third-party claim
            against OpenBB unless OpenBB consents to such settlement, and further
            provided that OpenBB will have the right, at its option, to defend itself
            against any such third-party claim or to participate in the defense thereof
            by counsel of its own choice at no cost to the Customer.
          </p>
        </li>
        <li>
          <p>
            Third Party Services. Customer acknowledges and agrees that the Services
            operates on or with or using application programming interfaces (APIs)
            and/or other services operated or provided by third parties (“Third Party
            Services”). OpenBB is not responsible for the operation of any Third Party
            Services nor the availability or operation of the Services to the extent
            such availability and operation is dependent upon Third Party Services.
            Customer is solely responsible for procuring any and all rights necessary
            for it to access Third Party Services and for complying with any applicable
            terms or conditions thereof. OpenBB does not make any representations or
            warranties with respect to Third Party Services or any third party
            providers. If Customer authorizes or otherwise directs OpenBB to integrate
            Customer’s account(s) to any Third Party Services with the Services,
            Customer hereby represents and warrants that Customer has all the rights and
            authority to authorize OpenBB to do so. Any exchange of data or other
            interaction between Customer and a third party provider is solely between
            Customer and such third party provider and is governed by such third party’s
            terms and conditions.
          </p>
        </li>
      </ol>
      <h2 id="fees-and-payment">6. Fees and Payment</h2>
      <ol type="a">
        <li>
          <p>
            Fees. Customer shall pay OpenBB the fees (“Fees”) as set forth in Order Form
            or as presented to Customer prior to Customer’s confirmation of the purchase
            of the Services through OpenBB’s online platform, without offset or
            deduction. Customer shall make all payments hereunder in US dollars on or
            before the due date set forth in Order Form. If Customer fails to make any
            payment when due, without limiting OpenBB’s other rights and remedies: (i)
            OpenBB may charge interest on the past due amount at the rate of 1.0% per
            month calculated daily and compounded monthly or, if lower, the highest rate
            permitted under applicable law; (ii) Customer shall reimburse OpenBB for all
            costs incurred by OpenBB in collecting any late payments or interest,
            including attorneys’ fees, court costs, and collection agency fees; and
            (iii) if such failure continues for 10 days or more, OpenBB may suspend
            Customer’s and its Authorized Users’ access to any portion or all of the
            Services until such amounts are paid in full.
          </p>
        </li>
        <li>
          <p>
            Taxes. All Fees and other amounts payable by Customer under this Agreement
            are exclusive of taxes and similar assessments. Customer is responsible for
            all sales, use, and excise taxes, and any other similar taxes, duties, and
            charges of any kind imposed by any federal, state, or local governmental or
            regulatory authority on any amounts payable by Customer hereunder, other
            than any taxes imposed on OpenBB’s income.
          </p>
        </li>
      </ol>
      <h2 id="confidential-information">7. Confidential Information</h2>
      <p>
        From time to time during the Term, either Party may disclose or make available
        to the other Party information about its business affairs, products,
        confidential intellectual property, trade secrets, third-party confidential
        information, and other sensitive or proprietary information, whether or not
        marked, designated or otherwise identified as “confidential” (collectively,
        “Confidential Information”). Confidential Information does not include
        information that, at the time of disclosure: (a) is or becomes generally
        available to the public; (b) was or is known to the receiving Party at the time
        of disclosure; (c) was or is rightfully obtained by the receiving Party without
        confidentiality restrictions from a third party; or (d) independently developed
        by the receiving Party. The receiving Party shall not disclose the disclosing
        Party’s Confidential Information to any person or entity, except to the
        receiving Party’s employees, consultants, or contractors who have a need to know
        the Confidential Information for the receiving Party to exercise its rights or
        perform its obligations hereunder. Notwithstanding the foregoing, each Party may
        disclose Confidential Information to the limited extent required (i) in order to
        comply with the order of a court or other governmental body, or as otherwise
        necessary to comply with applicable law, provided that the Party making the
        disclosure pursuant to the order shall first have given written notice to the
        other Party and made a reasonable effort to obtain a protective order; or (ii)
        to establish a Party’s rights under this Agreement, including to make required
        court filings. If Customer or any of its employees or contractors sends or
        transmits any communications or materials to OpenBB suggesting or recommending
        changes to the OpenBB IP, including without limitation, new features or
        functionality relating thereto, or any comments, questions, suggestions, or the
        like (“Feedback”), OpenBB is free to use such Feedback irrespective of any other
        obligation or limitation between the Parties governing such Feedback. On the
        expiration or termination of the Agreement, the receiving Party shall promptly
        return to the disclosing Party all copies, whether in written, electronic, or
        other form or media, of the disclosing Party’s Confidential Information, or
        destroy all such copies and certify in writing to the disclosing Party that such
        Confidential Information has been destroyed. Each Party’s confidentiality
        obligations with regard to Confidential Information are effective as of the
        Effective Date and will expire five years from the date first disclosed to the
        receiving Party; provided, however, with respect to any Confidential Information
        that constitutes a trade secret (as determined under applicable law), such
        obligations of non-disclosure will survive the termination or expiration of this
        Agreement for as long as such Confidential Information remains subject to trade
        secret protection under applicable law.
      </p>
      <h2 id="warranties-and-disclaimers">8. Warranties and Disclaimers</h2>
      <ol type="a">
        <li>
          <p>
            Customer. Customer represents and warrants that (i) it is duly organized,
            validly existing, and in good standing under the laws of the state of its
            organization; (ii) it has full power and authority to enter into this
            Agreement, to carry out its obligations under this Agreement, and to grant
            the rights granted to OpenBB herein; and (iii) the execution of this
            Agreement by Customer, and Customer’s performance of its obligations and
            duties hereunder do not and will not violate any other agreement to which
            Customer is a party or by which Customer is otherwise bound.
          </p>
        </li>
        <li>
          <p>
            OpenBB. OpenBB warrants that it will not knowingly include, in any Software
            released to the public and provided to Customer hereunder, any computer code
            or other computer instructions, devices or techniques, including without
            limitation those known as disabling devices, trojans, or time bombs, that
            intentionally disrupt, disable, harm, infect, defraud, damage, or otherwise
            impede in any manner, the operation of a network, computer program or
            computer system or any component thereof, including its security or user
            data.
          </p>
        </li>
        <li>
          <p>
            Similarity of Output. Customer acknowledges that due to the nature of the
            Services and artificial intelligence generally, the Customer Outputs may not
            be unique and other customers may receive similar data or outputs from the
            Services, and that nothing hereunder prevents or restricts OpenBB from (i)
            developing and providing its products and services to other customers
            without use of any Customer Input, and (ii) utilizing “skills or knowledge
            of a general nature” acquired during the course of providing the Services
            and performing hereunder. “Skills or knowledge of a general nature” shall
            include, without limitation, anything that might reasonably be acquired in
            similar work performed for another party.
          </p>
        </li>
        <li>
          <p>
            No Investment Advice; Not Financial Advisor. Customer acknowledges that (i)
            no Services should be construed as professional advice of any kind
            (including financial planning, business, employment, investment, accounting,
            tax, and/or legal advice), (ii) the Services are not intended to be a
            substitute for the professional advice of a financial planner, financial
            advisor, accountant or otherwise, and (iii) the Services are not a
            recommendation of an investment strategy or to buy or sell any security,
            digital asset (cryptocurrency, etc) in any account. Customer acknowledges
            that the Services are not research reports and are not intended to serve as
            the basis for any investment decision.
          </p>
        </li>
        <li>
          <p>
            Beta Services. OpenBB may offer Services that are in pre-release, beta, or
            trial form (“Beta Services”). Customer acknowledges and agrees that Beta
            Services are not suitable for production use and provided “as-is” on a
            temporary basis. OpenBB is not responsible for Customer’s use of or reliance
            on Beta Services.
          </p>
        </li>
        <li>
          <p>
            Disclaimers. EXCEPT FOR THE LIMITED WARRANTY SET FORTH IN SECTION 8(b), THE
            OPENBB IP IS PROVIDED “AS IS” AND OPENBB HEREBY DISCLAIMS ALL WARRANTIES,
            WHETHER EXPRESS, IMPLIED, STATUTORY, OR OTHERWISE. OPENBB SPECIFICALLY
            DISCLAIMS ALL IMPLIED WARRANTIES OF MERCHANTABILITY, FITNESS FOR A
            PARTICULAR PURPOSE, TITLE, AND NON-INFRINGEMENT, AND ALL WARRANTIES ARISING
            FROM COURSE OF DEALING, USAGE, OR TRADE PRACTICE. EXCEPT FOR THE LIMITED
            WARRANTY SET FORTH IN SECTION 8(b), OPENBB MAKES NO REPRESENTATION OR
            WARRANTY OF ANY KIND (A) WITH RESPECT TO THIRD PARTY SERVICES, OR (B) THAT
            THE OPENBB IP, OR ANY PRODUCTS OR RESULTS OF THE USE THEREOF, WILL MEET
            CUSTOMER’S OR ANY OTHER PERSON’S REQUIREMENTS, OPERATE WITHOUT INTERRUPTION,
            ACHIEVE ANY INTENDED RESULT, BE COMPATIBLE OR WORK WITH ANY SOFTWARE, SYSTEM
            OR OTHER SERVICES, OR BE SECURE, ACCURATE, COMPLETE, FREE OF HARMFUL CODE,
            OR ERROR FREE.
          </p>
        </li>
      </ol>
      <h2 id="limitations-of-liability">9. Limitations of Liability</h2>
      <ol type="a">
        <li>
          <p>
            Indirect Liabilities. IN NO EVENT WILL OPENBB BE LIABLE UNDER OR IN
            CONNECTION WITH THIS AGREEMENT UNDER ANY LEGAL OR EQUITABLE THEORY,
            INCLUDING BREACH OF CONTRACT, TORT (INCLUDING NEGLIGENCE), STRICT LIABILITY
            AND OTHERWISE, FOR ANY: (A) CONSEQUENTIAL, INCIDENTAL, INDIRECT, EXEMPLARY,
            SPECIAL, ENHANCED, OR PUNITIVE DAMAGES; (B) INCREASED COSTS, DIMINUTION IN
            VALUE OR LOST BUSINESS, PRODUCTION, REVENUES, OR PROFITS; (C) LOSS OF
            GOODWILL OR REPUTATION; (D) USE, INABILITY TO USE, LOSS, INTERRUPTION, DELAY
            OR RECOVERY OF ANY DATA, OR BREACH OF DATA OR SYSTEM SECURITY; OR (E) COST
            OF REPLACEMENT GOODS OR SERVICES, IN EACH CASE REGARDLESS OF WHETHER OPENBB
            WAS ADVISED OF THE POSSIBILITY OF SUCH LOSSES OR DAMAGES OR SUCH LOSSES OR
            DAMAGES WERE OTHERWISE FORESEEABLE.
          </p>
        </li>
        <li>
          <p>
            Direct Liability. IN NO EVENT WILL OPENBB’S AGGREGATE LIABILITY ARISING OUT
            OF OR RELATED TO THIS AGREEMENT UNDER ANY LEGAL OR EQUITABLE THEORY
            INCLUDING BREACH OF CONTRACT, TORT (INCLUDING NEGLIGENCE), STRICT LIABILITY
            AND OTHERWISE EXCEED THE TOTAL AMOUNTS PAID TO OPENBB UNDER THIS AGREEMENT
            IN THE TWELVE MONTH PERIOD PRECEDING THE EVENT GIVING RISE TO THE CLAIM OR
            ONE HUNDRED THOUSAND U.S. DOLLARS ($100,000), WHICHEVER IS LESS.
          </p>
        </li>
        <li>
          <p>
            Exclusions. THE FOREGOING LIMITATIONS IN THIS SECTION 9 SHALL NOT APPLY TO
            DAMAGES ARISING OUT OF ANY BREACH OF CONFIDENTIALITY OBLIGATIONS SET FORTH
            IN SECTION 7.
          </p>
        </li>
      </ol>
      <h2 id="term-and-termination">10. Term and Termination</h2>
      <ol type="a">
        <li>
          <p>
            Term. The term of this Agreement will commence upon the earlier of the
            effective date set forth on the Customer’s first Order Form, or the date
            Customer first uses the Services, or Customer’s online acceptance of this
            Agreement, subject to early termination as provided herein (the “Term”).
            This Agreement will continue to govern any Order Form for the duration of
            the applicable Services Term. If there is no outstanding Order Form, this
            Agreement will expire twenty-four months after the ending date of the last
            Order Form.
          </p>
        </li>
        <li>
          <p>
            Termination. In addition to any other express termination right set forth in
            this Agreement:
          </p>
        </li>
        <li>
          <p>
            either Party may terminate this Agreement or the applicable Order Form,
            effective on written notice to the other Party, if the other Party
            materially breaches this Agreement or the applicable Order Form, and such
            breach:
          </p>
        </li>
      </ol>
      <ol type="A">
        <li>is incapable of cure; or</li>
        <li>
          being capable of cure, remains uncured 30 days (or 10 days for Customer’s
          failure to pay any amount when due) after the non-breaching Party provides the
          breaching Party with written notice of such breach; or
        </li>
      </ol>
      <ol type="i">
        <li>
          either Party may terminate this Agreement, effective immediately upon written
          notice to the other Party, if the other Party:
        </li>
      </ol>
      <ol type="A">
        <li>
          becomes insolvent or is generally unable to pay, or fails to pay, its debts as
          they become due;
        </li>
        <li>
          files or has filed against it, a petition for voluntary or involuntary
          bankruptcy or otherwise becomes subject, voluntarily or involuntarily, to any
          proceeding under any domestic or foreign bankruptcy or insolvency law;
        </li>
        <li>
          makes or seeks to make a general assignment for the benefit of its creditors;
          or
        </li>
        <li>
          applies for or has appointed a receiver, trustee, custodian, or similar agent
          appointed by order of any court of competent jurisdiction to take charge of or
          sell any material portion of its property or business. Termination of this
          Agreement will terminate all Order Forms. Termination of a specific Order Form
          will not impact the other Order Forms.
        </li>
      </ol>
      <ol type="a">
        <li>
          Effect of Expiration or Termination. Upon expiration or earlier termination of
          this Agreement or an applicable Order Form, Customer shall immediately
          discontinue use of the OpenBB IP subject to such termination and, without
          limiting Customer’s obligations under Section 7, Customer shall delete,
          destroy, or return all copies of such OpenBB IP and certify in writing to
          OpenBB that such OpenBB IP has been deleted or destroyed. No expiration or
          termination will affect Customer’s obligation to pay all Fees that may have
          become due before such expiration or termination, or entitle Customer to any
          refund.
        </li>
        <li>
          Survival. This Section 10(d) and Sections 1, 2(c), 4(other than (d)), 5, 6, 7,
          8(c)-(f), 9, and 11 survive any termination or expiration of this Agreement.
          No other provisions of this Agreement survive the expiration or earlier
          termination of this Agreement.
        </li>
      </ol>
      <h2 id="miscellaneous.">11. Miscellaneous.</h2>
      <ol type="a">
        <li>
          <p>
            Entire Agreement. This Agreement, together with all Order Forms and other
            documents (if any) incorporated herein by reference, constitutes the sole
            and entire agreement of the Parties with respect to the subject matter of
            this Agreement and supersedes all prior and contemporaneous understandings,
            agreements, and representations and warranties, both written and oral, with
            respect to such subject matter. In the event of any inconsistency between
            the statements made in the body of this Agreement, the Order Forms, and any
            other documents incorporated herein by reference, the following order of
            precedence governs: (i) first, the terms and conditions of this Agreement;
            (ii) second, the Order Forms; and (iii) third, any other documents
            incorporated herein by reference.
          </p>
        </li>
        <li>
          <p>
            Notices. All notices, requests, consents, claims, demands, waivers, and
            other communications hereunder (each, a “Notice”) must be in writing and
            addressed to the Parties at the addresses set forth on the first page of
            this Agreement (or to such other address that may be designated by the Party
            giving Notice from time to time in accordance with this Section). All
            Notices must be delivered by personal delivery, nationally recognized
            overnight courier (with all fees pre-paid), facsimile (with confirmation of
            transmission) or certified or registered mail (in each case, return receipt
            requested, postage pre-paid). Except as otherwise provided in this
            Agreement, a Notice is effective only: (i) upon receipt by the receiving
            Party; and (ii) if the Party giving the Notice has complied with the
            requirements of this Section.
          </p>
        </li>
        <li>
          <p>
            Force Majeure. In no event shall either Party be liable to the other Party,
            or be deemed to have breached this Agreement, for any failure or delay in
            performing its obligations under this Agreement (except for any obligations
            to make payments), if and to the extent such failure or delay is caused by
            any circumstances beyond such Party’s reasonable control, including but not
            limited to acts of God, flood, fire, earthquake, explosion, war, terrorism,
            invasion, riot or other civil unrest, strikes, labor stoppages or slowdowns
            or other industrial disturbances, or passage of law, or any action taken by
            a governmental or public authority including imposing an embargo.
          </p>
        </li>
        <li>
          <p>
            Waiver. No waiver by any Party of any of the provisions hereof will be
            effective unless explicitly set forth in writing and signed by the Party so
            waiving. Except as otherwise set forth in this Agreement, (i) no failure to
            exercise, or delay in exercising, any rights, remedy, power, or privilege
            arising from this Agreement will operate or be construed as a waiver thereof
            and (ii) no single or partial exercise of any right, remedy, power, or
            privilege hereunder will preclude any other or further exercise thereof or
            the exercise of any other right, remedy, power, or privilege.
          </p>
        </li>
        <li>
          <p>
            Severability. If any provision of this Agreement is invalid, illegal, or
            unenforceable in any jurisdiction, such invalidity, illegality, or
            unenforceability will not affect any other term or provision of this
            Agreement or invalidate or render unenforceable such term or provision in
            any other jurisdiction. Upon such determination that any term or other
            provision is invalid, illegal, or unenforceable, the Parties shall negotiate
            in good faith to modify this Agreement so as to effect their original intent
            as closely as possible in a mutually acceptable manner in order that the
            transactions contemplated hereby be consummated as originally contemplated
            to the greatest extent possible.
          </p>
        </li>
        <li>
          <p>
            Governing Law; Submission to Jurisdiction. This Agreement is governed by and
            construed in accordance with the internal laws of the State of California
            without giving effect to any choice or conflict of law provision or rule
            that would require or permit the application of the laws of any jurisdiction
            other than those of the State of California. Any legal suit, action, or
            proceeding arising out of or related to this Agreement or the licenses
            granted hereunder will be instituted exclusively in the federal courts of
            the United States or the courts of the State of California in each case
            located in the city of San Francisco, and each Party irrevocably submits to
            the exclusive jurisdiction of such courts in any such suit, action, or
            proceeding.
          </p>
        </li>
        <li>
          <p>
            Assignment. Neither Party may assign any of its rights or delegate any of
            its obligations hereunder without the prior written consent of the other
            Party, which consent shall not be unreasonably withheld, conditioned, or
            delayed, except that either Party may assign this Agreement without consent
            of the other Party to its successor in interest pursuant to a merger,
            acquisition, corporate reorganization, or sale of all or substantially all
            of its assets to which this Agreement relate. Any purported assignment or
            delegation in violation of this Section will be null and void. No assignment
            or delegation will relieve the assigning or delegating Party of any of its
            obligations hereunder. This Agreement is binding upon and inures to the
            benefit of the Parties and their respective permitted successors and
            assigns.
          </p>
        </li>
        <li>
          <p>
            Export Regulation. The Services utilize software and technology that may be
            subject to US export control laws, including the US Export Administration
            Act and its associated regulations. Customer shall not, directly or
            indirectly, export, re-export, or release the Services or the underlying
            software or technology to, or make the Services or the underlying software
            or technology accessible from, any jurisdiction or country to which export,
            re-export, or release is prohibited by law, rule, or regulation. Customer
            shall comply with all applicable federal laws, regulations, and rules, and
            complete all required undertakings (including obtaining any necessary export
            license or other governmental approval), prior to exporting, re-exporting,
            releasing, or otherwise making the Services or the underlying software or
            technology available outside the US.
          </p>
        </li>
        <li>
          <p>
            US Government Rights. Each of the Documentation and the software components
            that constitute the Services is a “commercial item” as that term is defined
            at 48 C.F.R. § 2.101, consisting of “commercial computer software” and
            “commercial computer software documentation” as such terms are used in 48
            C.F.R. § 12.212. Accordingly, if Customer is an agency of the US Government
            or any contractor therefor, Customer only receives those rights with respect
            to the Services and Documentation as are granted to all other end users, in
            accordance with (a) 48 C.F.R. § 227.7201 through 48 C.F.R. § 227.7204, with
            respect to the Department of Defense and their contractors, or (b) 48 C.F.R.
            § 12.212, with respect to all other US Government users and their
            contractors.
          </p>
        </li>
        <li>
          <p>
            Equitable Relief. Each Party acknowledges and agrees that a breach or
            threatened breach by such Party of any of its obligations under Section 7
            or, in the case of Customer, Section 2(d), would cause the other Party
            irreparable harm for which monetary damages would not be an adequate remedy
            and agrees that, in the event of such breach or threatened breach, the other
            Party will be entitled to equitable relief, including a restraining order,
            an injunction, specific performance and any other relief that may be
            available from any court, without any requirement to post a bond or other
            security, or to prove actual damages or that monetary damages are not an
            adequate remedy. Such remedies are not exclusive and are in addition to all
            other remedies that may be available at law, in equity or otherwise.
          </p>
        </li>
        <li>
          <p>
            Publicity. OpenBB is permitted to disclose that Customer is one of its
            customers to any third-party at its sole discretion. Customer agrees that
            OpenBB may use Customer’s name, logo, and other identifying information in
            press releases, case studies, testimonials, trade shows, or other marketing
            materials (the “Publicity Activities”). Customer acknowledges that
            participation in the Publicity Activities is voluntary and subject to its
            own discretion, however Customer agrees to reasonably cooperate with OpenBB
            in participating in the Publicity Activities.
          </p>
        </li>
        <li>
          <p>
            Amendments. OpenBB may amend the terms and conditions of Agreement from time
            to time, in which case the new Agreement will supersede prior versions.
            OpenBB will use commercially reasonable efforts to provide advance notice to
            Customer of any material amendment. If Customer does not agree to any
            amendment, Customer may opt out of the automatic renewal prior to the
            expiration of the then-current subscription term under Orders Forms entered
            into prior to such amendment, which will continue to be subject to the prior
            version of this Agreement (without such amendment). Customer’s continued use
            of the Services following the effective date of any such amendment
            constitute Customer’s agreement to any such amendment. Any Order Forms
            executed after the effective date of an amendment shall constitute
            Customer’s agreement to any such amendment. OpenBB’s acceptance of any
            document submitted by Customer to OpenBB shall not be construed as an
            acceptance of provisions which are in any way in conflict or inconsistent
            with, or in addition to, this Agreement, unless such terms are separately
            and specifically accepted in writing by an authorized representative of
            OpenBB.
          </p>
          <p ref={lastElementRef} />
        </li>
      </ol>
    </div>
  );
}
