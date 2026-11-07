export type OK<T> =
	| {
			success: true;
			data: T;
	  }
	| {
			success: false;
			reason: any;
	  };
