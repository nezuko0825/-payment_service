import { Router, Request, Response } from 'express';
import { validateCreateInvoice, validateGetInvoice } from '../middleware/validation';
import { InvoiceService } from '../services/invoiceService';
import { AppError } from '../middleware/errorHandler';

const router = Router();

/**
 * @route   POST /invoice
 * @desc    Create a new invoice
 * @access  Public
 */
router.post('/', validateCreateInvoice, async (req: Request, res: Response) => {
  try {
    const { merchantId, amount, currency = 'USD' } = req.body;

    const result = await InvoiceService.createInvoice({
      merchantId,
      amount,
      currency
    });

    res.status(201).json({
      success: true,
      data: result
    });
  } catch (error) {
    if (error instanceof AppError) {
      res.status(error.statusCode).json({
        success: false,
        error: error.message
      });
    } else {
      console.error('Create invoice error:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to create invoice'
      });
    }
  }
});

/**
 * @route   GET /invoice/:id
 * @desc    Get invoice status
 * @access  Public
 */
router.get('/:id', validateGetInvoice, async (req: Request, res: Response) => {
  try {
    const { id } = req.params;

    const result = await InvoiceService.getInvoiceById(id as string);

    res.status(200).json({
      success: true,
      data: result
    });
  } catch (error) {
    if (error instanceof AppError) {
      res.status(error.statusCode).json({
        success: false,
        error: error.message
      });
    } else {
      console.error('Get invoice error:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to get invoice'
      });
    }
  }
});

/**
 * @route   POST /invoice/:id/validate
 * @desc    Validate invoice (for testing purposes)
 * @access  Public
 */
router.post('/:id/validate', validateGetInvoice, async (req: Request, res: Response) => {
  try {
    const { id } = req.params;

    // Check if invoice exists
    const invoice = await InvoiceService.getInvoiceById(id as string);

    res.status(200).json({
      success: true,
      data: {
        isValid: true,
        invoice
      }
    });
  } catch (error) {
    res.status(404).json({
      success: false,
      error: 'Invoice not found or invalid'
    });
  }
});

export default router;